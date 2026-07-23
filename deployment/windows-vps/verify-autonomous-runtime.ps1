param(
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$FrontendUrl = "",
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [string]$RuntimeRoot = "C:\ProgramData\TradingAnalysisPlatform\runtime",
  [string]$BackupRoot = "C:\trading-analysis-platform\backups",
  [string]$ExpectedCommit = ""
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0
$script:WarnCount = 0
if (-not $FrontendUrl) { $FrontendUrl = $BackendUrl }

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("autonomous-runtime-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null

function Report {
  param([string]$Level, [string]$Name, [string]$Detail)
  if ($Level -eq "FAIL") { $script:FailCount += 1 }
  if ($Level -eq "WARN") { $script:WarnCount += 1 }
  Write-Host "$Level $Name - $Detail"
}

function Test-WindowsService {
  param([string]$Pattern, [string]$Name, [bool]$WarnIfMissing = $false)
  $service = Get-Service -Name $Pattern -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $service) {
    if ($WarnIfMissing) { Report "WARN" $Name "service not found" } else { Report "FAIL" $Name "service not found" }
    return
  }
  if ($service.Status -eq "Running") { Report "PASS" $Name "$($service.Name) running" } else { Report "FAIL" $Name "$($service.Name) status $($service.Status)" }
}

function Get-RealBridgeProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and
    $_.CommandLine -like "*mt5_candle_bridge.py*" -and
    $_.CommandLine -like "*--run-continuous*"
  })
}

function Test-ManagedTask {
  param([string]$TaskName, [bool]$RequireRunning = $false, [bool]$RequireStartupTrigger = $false)
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) {
    Report "FAIL" $TaskName "not registered"
    return
  }

  $lastTaskResult = if ($taskInfo) { $taskInfo.LastTaskResult } else { "unavailable" }
  if ($RequireRunning -and $task.State -ne "Running") {
    Report "FAIL" $TaskName "State=$($task.State) LastTaskResult=$lastTaskResult"
  } else {
    Report "PASS" $TaskName "State=$($task.State) LastTaskResult=$lastTaskResult"
  }

  $arguments = [string](@($task.Actions | ForEach-Object { $_.Arguments }) -join " ")
  if ($arguments -match "DB_PASSWORD|MT5_BRIDGE_SECRET|replace-with|password=") {
    Report "FAIL" "$TaskName-action-secrets" "scheduled task action appears to contain secret material"
  } else {
    Report "PASS" "$TaskName-action-secrets" "no secret variable values or names embedded in action arguments"
  }

  if ($arguments -like "*-NonInteractive*") {
    Report "PASS" "$TaskName-noninteractive" "PowerShell task action is noninteractive"
  } else {
    Report "FAIL" "$TaskName-noninteractive" "PowerShell task action is missing -NonInteractive"
  }

  if ([int]$task.Settings.RestartCount -gt 0 -or -not $RequireRunning) {
    Report "PASS" "$TaskName-restart" "RestartCount=$($task.Settings.RestartCount)"
  } else {
    Report "FAIL" "$TaskName-restart" "restart behavior is not configured"
  }

  $triggerTypes = @($task.Triggers | ForEach-Object { $_.CimClass.CimClassName }) -join ","
  if ($RequireStartupTrigger -and $triggerTypes -notmatch "BootTrigger") {
    Report "FAIL" "$TaskName-startup" "startup trigger missing; Triggers=$triggerTypes"
  } else {
    Report "PASS" "$TaskName-triggers" "Triggers=$triggerTypes"
  }
}

try {
  $health = Invoke-RestMethod -Uri "$BackendUrl/api/system/health" -TimeoutSec 10
  if ($health.application_status -eq "available" -and $health.database_status -eq "available") {
    Report "PASS" "backend-health" "backend and database available"
  } else {
    Report "FAIL" "backend-health" "application=$($health.application_status) database=$($health.database_status)"
  }
  if ($health.continuous_bridge_status -eq "available" -and [int]$health.continuous_bridge_process_count -eq 1) {
    Report "PASS" "bridge-freshness" "backend reports continuous bridge available"
  } else {
    Report "FAIL" "bridge-freshness" "status=$($health.continuous_bridge_status) count=$($health.continuous_bridge_process_count)"
  }
} catch {
  Report "FAIL" "backend-health" $_.Exception.Message
}

try {
  $frontend = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 10
  if ([int]$frontend.StatusCode -eq 200) { Report "PASS" "frontend-http" "HTTP 200" } else { Report "FAIL" "frontend-http" "HTTP $($frontend.StatusCode)" }
} catch {
  Report "FAIL" "frontend-http" $_.Exception.Message
}

Test-WindowsService -Pattern "postgresql*" -Name "postgres-service"
Test-WindowsService -Pattern "Tailscale" -Name "tailscale-service" -WarnIfMissing $true

$mt5Process = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mt5Process) { Report "PASS" "mt5-process" "terminal64 PID=$($mt5Process.Id)" } else { Report "FAIL" "mt5-process" "terminal64.exe not found" }

$bridgeProcesses = Get-RealBridgeProcesses
if (@($bridgeProcesses).Count -eq 1) {
  Report "PASS" "bridge-process-count" "exactly one continuous bridge process"
} else {
  Report "FAIL" "bridge-process-count" "found $(@($bridgeProcesses).Count) continuous bridge process(es)"
}

$stateFile = Join-Path $RuntimeRoot "mt5_bridge_state.json"
$lockFile = Join-Path $RuntimeRoot "mt5_continuous_bridge.lock"
if (Test-Path $stateFile) { Report "PASS" "runtime-state-file" $stateFile } else { Report "WARN" "runtime-state-file" "not found yet: $stateFile" }
if (Test-Path $lockFile) { Report "PASS" "runtime-lock-file" $lockFile } else { Report "WARN" "runtime-lock-file" "not found yet: $lockFile" }

Test-ManagedTask -TaskName "TradingAnalysisPlatform-Backend" -RequireRunning $true -RequireStartupTrigger $true
Test-ManagedTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -RequireRunning $true -RequireStartupTrigger $true
Test-ManagedTask -TaskName "TradingAnalysisPlatform-HealthCheck"
Test-ManagedTask -TaskName "TradingAnalysisPlatform-DailyBackup"

$latestBackup = Get-ChildItem $BackupRoot -Recurse -Filter "*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestBackup -and $latestBackup.Length -gt 0) {
  Report "PASS" "latest-backup" "$($latestBackup.FullName) Length=$($latestBackup.Length)"
} else {
  Report "FAIL" "latest-backup" "no valid non-empty backup dump found"
}

Push-Location $RepoRoot
try {
  $currentCommit = (& git rev-parse HEAD).Trim()
  if ($ExpectedCommit -and $currentCommit -ne $ExpectedCommit) {
    Report "FAIL" "git-commit" "expected $ExpectedCommit got $currentCommit"
  } else {
    Report "PASS" "git-commit" $currentCommit
  }

  $drift = @(& git status --porcelain --untracked-files=normal)
  if ($drift.Count -gt 0) {
    $drift | ForEach-Object { Report "FAIL" "git-drift" $_ }
  } else {
    Report "PASS" "git-drift" "no tracked or untracked source drift"
  }

  $legacyLock = Join-Path $RepoRoot "tools\mt5_bridge\mt5_continuous_bridge.lock"
  if (Test-Path $legacyLock) {
    Report "FAIL" "legacy-runtime-lock" "source-tree lock still exists: $legacyLock"
  } else {
    Report "PASS" "legacy-runtime-lock" "no bridge lock in Git working tree"
  }
} finally {
  Pop-Location
}

if ($script:FailCount -gt 0) {
  Write-Host "FAIL autonomous runtime verification ($script:FailCount failure(s), $script:WarnCount warning(s))"
  Write-Host "Transcript: $TranscriptPath"
  Stop-Transcript | Out-Null
  exit 2
}

Write-Host "PASS autonomous runtime verification ($script:WarnCount warning(s))"
Write-Host "Transcript: $TranscriptPath"
Stop-Transcript | Out-Null
exit 0
