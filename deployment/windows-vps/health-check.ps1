param(
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$FrontendUrl = "",
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [string]$BackupRoot = "C:\trading-analysis-platform\backups"
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0
$script:WarnCount = 0
$RequiredSymbols = @("BTCUSD", "XAUUSD", "USDJPY", "US500", "US100")

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("health-check-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null
if (-not $FrontendUrl) { $FrontendUrl = $BackendUrl }

function Report {
  param([string]$Level, [string]$Name, [string]$Detail)
  if ($Level -eq "FAIL") { $script:FailCount += 1 }
  if ($Level -eq "WARN") { $script:WarnCount += 1 }
  Write-Host "$Level $Name - $Detail"
}

function Add-Failure {
  param([System.Collections.ArrayList]$Failures, [string]$Name, [string]$Detail)
  [void]$Failures.Add("$Name - $Detail")
}

function Get-CoreHealthFailures {
  param($Health)
  $failures = New-Object System.Collections.ArrayList

  if ($Health.application_status -ne "available") { Add-Failure $failures "application-status" "expected available, got $($Health.application_status)" }
  if ($Health.database_status -ne "available") { Add-Failure $failures "database" "expected available, got $($Health.database_status)" }
  if ($Health.mt5_terminal_status -ne "available") { Add-Failure $failures "mt5-terminal" "expected available, got $($Health.mt5_terminal_status)" }
  if ($Health.mt5_tick_status -ne "available") { Add-Failure $failures "mt5-ticks" "expected available, got $($Health.mt5_tick_status)" }
  if ($Health.mt5_candles -ne "available") { Add-Failure $failures "mt5-candles" "expected available, got $($Health.mt5_candles)" }

  $reasonCodes = @($Health.degradation_reason_codes)
  if ($reasonCodes.Count -gt 0) { Add-Failure $failures "core-degradation-reason-codes" ($reasonCodes -join ",") }

  if ($Health.continuous_bridge_status -ne "available") { Add-Failure $failures "continuous-bridge" "expected available, got $($Health.continuous_bridge_status)" }
  if ([int]$Health.continuous_bridge_process_count -ne 1) { Add-Failure $failures "bridge-process-count" "expected 1, got $($Health.continuous_bridge_process_count)" }

  $futureViolations = @($Health.future_timestamp_violations)
  if ($futureViolations.Count -gt 0) { Add-Failure $failures "future-timestamps" "$($futureViolations.Count) violation(s)" }

  $staleWarnings = @($Health.stale_warnings)
  if ($staleWarnings.Count -gt 0) { Add-Failure $failures "mt5-freshness" "$($staleWarnings.Count) stale warning(s)" }

  $ticks = @($Health.latest_tick_by_symbol)
  foreach ($symbol in $RequiredSymbols) {
    $tick = $ticks | Where-Object { $_.symbol -eq $symbol -or $_.platform_symbol -eq $symbol } | Select-Object -First 1
    if (-not $tick) {
      Add-Failure $failures "tick-$symbol" "missing"
    } elseif (($tick.status -eq "live" -and $tick.is_fresh -eq $true) -or $tick.status -eq "market_closed") {
      continue
    } else {
      Add-Failure $failures "tick-$symbol" "expected live/fresh or market_closed, got $($tick.status)"
    }
  }

  return @($failures)
}

function Get-RealBridgeProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and
    $_.CommandLine -like "*mt5_candle_bridge.py*" -and
    $_.CommandLine -like "*--run-continuous*"
  })
}

function Wait-BackendHealth {
  $deadline = (Get-Date).AddSeconds(90)
  $lastFailures = @("backend health was not checked")
  $lastError = $null
  do {
    try {
      $health = Invoke-RestMethod -Uri "$BackendUrl/api/system/health" -TimeoutSec 10
      $failures = Get-CoreHealthFailures -Health $health
      if (@($failures).Count -eq 0) {
        Report "PASS" "backend-health" "strict core health available"
        return $health
      }
      $lastFailures = $failures
      $lastError = $null
    } catch {
      $lastError = $_.Exception.Message
      $lastFailures = @()
    }
    if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
  } while ((Get-Date) -lt $deadline)

  if ($lastError) {
    Report "FAIL" "backend-health" $lastError
  } else {
    foreach ($failure in $lastFailures) { Report "FAIL" "backend-health" $failure }
  }
  return $null
}

function Wait-Frontend {
  $deadline = (Get-Date).AddSeconds(60)
  $lastError = $null
  do {
    try {
      $frontend = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 10
      if ([int]$frontend.StatusCode -eq 200) {
        Report "PASS" "frontend" "HTTP 200"
        return
      }
      $lastError = "HTTP $($frontend.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }
    if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
  } while ((Get-Date) -lt $deadline)

  Report "FAIL" "frontend" $lastError
}

function Test-Task {
  param([string]$TaskName, [bool]$RequireRunning = $true)
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
}

function Test-WindowsService {
  param([string]$Pattern, [string]$Name, [bool]$WarnIfMissing = $false)
  $service = Get-Service -Name $Pattern -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $service) {
    if ($WarnIfMissing) { Report "WARN" $Name "service not found" } else { Report "FAIL" $Name "service not found" }
    return
  }
  if ($service.Status -eq "Running") {
    Report "PASS" $Name "$($service.Name) running"
  } else {
    Report "FAIL" $Name "$($service.Name) status $($service.Status)"
  }
}

$health = Wait-BackendHealth
Wait-Frontend

Test-WindowsService -Pattern "postgresql*" -Name "postgres-service"
Test-WindowsService -Pattern "Tailscale" -Name "tailscale-service" -WarnIfMissing $true

$mt5Process = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mt5Process) { Report "PASS" "mt5-process" "terminal64 PID=$($mt5Process.Id)" } else { Report "FAIL" "mt5-process" "terminal64.exe not found" }

Test-Task -TaskName "TradingAnalysisPlatform-Backend"

$drive = Get-PSDrive -Name C
if ($drive.Free -lt 10GB) { Report "WARN" "disk" "free space below 10GB" } else { Report "PASS" "disk" "$([math]::Round($drive.Free / 1GB, 2)) GB free" }

$os = Get-CimInstance Win32_OperatingSystem
$freeMemoryGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
if ($freeMemoryGb -lt 1) { Report "WARN" "memory" "$freeMemoryGb GB free" } else { Report "PASS" "memory" "$freeMemoryGb GB free" }

$state = Join-Path $RepoRoot "tools\mt5_bridge\mt5_bridge_state.json"
if (Test-Path $state) { Report "PASS" "bridge-last-success" "state file present" } else { Report "WARN" "bridge-last-success" "state file not found yet" }

$bridgeTask = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
$bridgeTaskInfo = Get-ScheduledTaskInfo -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
if (-not $bridgeTask) {
  Report "FAIL" "bridge-task" "not registered"
} else {
  $lastTaskResult = if ($bridgeTaskInfo) { $bridgeTaskInfo.LastTaskResult } else { "unavailable" }
  if ($bridgeTask.State -eq "Running") {
    Report "PASS" "bridge-task" "State=$($bridgeTask.State) LastTaskResult=$lastTaskResult"
  } else {
    Report "FAIL" "bridge-task" "State=$($bridgeTask.State) LastTaskResult=$lastTaskResult"
  }
}

$bridgeProcesses = Get-RealBridgeProcesses
if (@($bridgeProcesses).Count -eq 1) {
  Report "PASS" "bridge-process" "exactly one real Python bridge process"
} else {
  Report "FAIL" "bridge-process" "found $(@($bridgeProcesses).Count) real Python bridge process(es)"
}

if ($health) {
  if ($health.continuous_bridge_status -ne "available") { Report "FAIL" "backend-bridge-status" $health.continuous_bridge_status }
  if ([int]$health.continuous_bridge_process_count -ne 1) { Report "FAIL" "backend-bridge-process-count" $health.continuous_bridge_process_count }
}

Test-Task -TaskName "TradingAnalysisPlatform-HealthCheck" -RequireRunning $false
Test-Task -TaskName "TradingAnalysisPlatform-DailyBackup" -RequireRunning $false

$latestBackup = Get-ChildItem $BackupRoot -Recurse -Filter "*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestBackup -and $latestBackup.Length -gt 0) {
  Report "PASS" "latest-backup" "$($latestBackup.FullName) Length=$($latestBackup.Length)"
} else {
  Report "WARN" "latest-backup" "no non-empty backup dump found yet"
}

if ($script:FailCount -gt 0) {
  Write-Host "FAIL strict production health acceptance ($script:FailCount failure(s), $script:WarnCount warning(s))"
  Write-Host "Transcript: $TranscriptPath"
  Stop-Transcript | Out-Null
  exit 2
}

Write-Host "PASS strict production health acceptance ($script:WarnCount warning(s))"
Write-Host "Transcript: $TranscriptPath"
Stop-Transcript | Out-Null
exit 0
