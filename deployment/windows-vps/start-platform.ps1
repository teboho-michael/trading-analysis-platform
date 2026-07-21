param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [string]$CloudflaredConfig = ""
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$NpmExe = (Get-Command "npm" -ErrorAction Stop).Source

function Start-OwnedProcess {
  param([string]$Name, [string]$FilePath, [string]$Arguments, [string]$WorkingDirectory)
  if (-not (Test-Path $WorkingDirectory)) {
    throw "Working directory not found for ${Name}: $WorkingDirectory"
  }
  $stdoutLog = Join-Path $LogRoot "$Name.out.log"
  $stderrLog = Join-Path $LogRoot "$Name.err.log"
  $existing = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*TradingAnalysisPlatform:$Name*" }
  if ($existing) {
    if (@($existing).Count -gt 1) {
      throw "Multiple platform-owned $Name roots found: $(@($existing | ForEach-Object { $_.ProcessId }) -join ',')"
    }
    Set-Content -Path (Join-Path $LogRoot "$Name.pid") -Value $existing.ProcessId -Encoding ASCII
    Write-Host "PASS $Name already running"
    return
  }
  $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden -PassThru
  Set-Content -Path (Join-Path $LogRoot "$Name.pid") -Value $process.Id -Encoding ASCII
  Write-Host "PASS started $Name root PID $($process.Id)"
}

function Get-RealBridgeProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and
    $_.CommandLine -like "*mt5_candle_bridge.py*" -and
    $_.CommandLine -like "*--run-continuous*"
  })
}

function Wait-ContinuousBridge {
  param([string]$TaskName, [object]$LaunchTime = $null)
  $deadline = (Get-Date).AddSeconds(30)
  $failureCheckNotBefore = if ($LaunchTime) { $LaunchTime.AddSeconds(3) } else { $null }
  $reportedRunning = $false
  do {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    $bridgeProcesses = Get-RealBridgeProcesses
    $bridgeProcessCount = @($bridgeProcesses).Count
    if ($bridgeProcessCount -gt 1) {
      $processIds = @($bridgeProcesses | ForEach-Object { $_.ProcessId }) -join ","
      throw "Duplicate continuous MT5 bridge Python processes detected. PythonBridgeProcessCount=$bridgeProcessCount ProcessIds=$processIds"
    }
    if ($bridgeProcessCount -eq 1) {
      Write-Host "PASS continuous MT5 bridge Python process detected"
      return
    }
    if ($task.State -eq "Running" -and -not $reportedRunning) {
      Write-Host "INFO continuous MT5 bridge task is Running; waiting for the Python bridge process"
      $reportedRunning = $true
    }
    $currentLaunchFailed = $false
    if ($LaunchTime -and $failureCheckNotBefore -and (Get-Date) -ge $failureCheckNotBefore) {
      $currentLaunchFailed = $task.State -eq "Ready" -and $taskInfo -and $taskInfo.LastRunTime -ge $LaunchTime -and [int]$taskInfo.LastTaskResult -ne 0
    }
    if ($currentLaunchFailed) {
      throw "Continuous MT5 bridge task failed before a Python bridge process appeared. State=$($task.State) LastTaskResult=$($taskInfo.LastTaskResult) LastRunTime=$($taskInfo.LastRunTime) PythonBridgeProcessCount=$bridgeProcessCount"
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  $finalTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  $finalInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  $finalProcesses = Get-RealBridgeProcesses
  $finalProcessCount = @($finalProcesses).Count
  if ($finalProcessCount -gt 1) {
    $finalProcessIds = @($finalProcesses | ForEach-Object { $_.ProcessId }) -join ","
    throw "Duplicate continuous MT5 bridge Python processes detected. PythonBridgeProcessCount=$finalProcessCount ProcessIds=$finalProcessIds"
  }
  $lastTaskResult = if ($finalInfo) { $finalInfo.LastTaskResult } else { "unavailable" }
  $lastRunTime = if ($finalInfo) { $finalInfo.LastRunTime } else { "unavailable" }
  $taskState = if ($finalTask) { $finalTask.State } else { "missing" }
  throw "Continuous MT5 bridge did not become ready within 30 seconds. State=$taskState LastTaskResult=$lastTaskResult LastRunTime=$lastRunTime PythonBridgeProcessCount=$finalProcessCount"
}

$postgres = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($postgres -and $postgres.Status -ne "Running") {
  Start-Service $postgres.Name
}
Write-Host "PASS PostgreSQL service checked; keep PostgreSQL bound to localhost/private interfaces only"

Start-OwnedProcess -Name "backend" -FilePath $PowerShellExe -Arguments "-NoProfile -ExecutionPolicy Bypass -Command `"Write-Host 'TradingAnalysisPlatform:backend'; & '$NpmExe' start`"" -WorkingDirectory (Join-Path $RepoRoot "server")
Start-OwnedProcess -Name "frontend" -FilePath $PowerShellExe -Arguments "-NoProfile -ExecutionPolicy Bypass -Command `"Write-Host 'TradingAnalysisPlatform:frontend'; & '$NpmExe' run preview`"" -WorkingDirectory (Join-Path $RepoRoot "client")

$bridgeTask = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
if (-not $bridgeTask) { throw "TradingAnalysisPlatform-MT5ContinuousBridge is not registered" }
$bridgeLaunchTime = $null
if ($bridgeTask.State -ne "Running") {
  $bridgeLaunchTime = Get-Date
  Start-ScheduledTask -TaskName $bridgeTask.TaskName
}
Wait-ContinuousBridge -TaskName $bridgeTask.TaskName -LaunchTime $bridgeLaunchTime

if ($CloudflaredConfig -and (Test-Path $CloudflaredConfig)) {
  $CloudflaredExe = (Get-Command "cloudflared" -ErrorAction Stop).Source
  Start-OwnedProcess -Name "cloudflared" -FilePath $PowerShellExe -Arguments "-NoProfile -ExecutionPolicy Bypass -Command `"Write-Host 'TradingAnalysisPlatform:cloudflared'; & '$CloudflaredExe' tunnel --config '$CloudflaredConfig' run`"" -WorkingDirectory $RepoRoot
} else {
  Write-Host "WARN cloudflared config not supplied; Cloudflare diagnostic tunnel not started. Use Tailscale for stable private access."
}
