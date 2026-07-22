param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

function Remove-OldLogs {
  param([int]$RetentionDays = 14)
  Get-ChildItem $LogRoot -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) -and $_.Name -notlike "deploy-production-*" -and $_.Name -notlike "rollback-production-*" } |
    Remove-Item -Force
}

function Get-TaskStateText {
  param([string]$TaskName)
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) { return "missing" }
  return [string]$task.State
}

function Start-PlatformTask {
  param([string]$TaskName)
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) { throw "$TaskName is not registered. Run register-scheduled-tasks.ps1 first." }
  if ($task.State -ne "Running") {
    Start-ScheduledTask -TaskName $TaskName
  }
}

function Wait-Backend {
  $taskName = "TradingAnalysisPlatform-Backend"
  $deadline = (Get-Date).AddSeconds(90)
  $lastError = $null
  do {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/health" -TimeoutSec 10
      if ($response.backend -eq "available" -or $response.application_status) {
        Write-Host "PASS backend health endpoint responded"
        return
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    $taskState = Get-TaskStateText -TaskName $taskName
    if ($taskState -eq "Ready") { throw "$taskName exited before backend became healthy. LastError=$lastError" }
    if ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
  } while ((Get-Date) -lt $deadline)

  throw "Backend did not become healthy within 90 seconds. LastError=$lastError"
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

Remove-OldLogs

& (Join-Path $RepoRoot "deployment\windows-vps\validate-production-config.ps1") -Component All -RepoRoot $RepoRoot -LogRoot $LogRoot

$postgres = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($postgres -and $postgres.Status -ne "Running") {
  Start-Service $postgres.Name
}
Write-Host "PASS PostgreSQL service checked; keep PostgreSQL bound to localhost/private interfaces only"

Start-PlatformTask -TaskName "TradingAnalysisPlatform-Backend"
Wait-Backend

$bridgeTask = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
if (-not $bridgeTask) { throw "TradingAnalysisPlatform-MT5ContinuousBridge is not registered" }
$bridgeLaunchTime = $null
if ($bridgeTask.State -ne "Running") {
  $bridgeLaunchTime = Get-Date
  Start-ScheduledTask -TaskName $bridgeTask.TaskName
}
Wait-ContinuousBridge -TaskName $bridgeTask.TaskName -LaunchTime $bridgeLaunchTime

Write-Host "PASS platform scheduled runtime started; frontend is served by the Node backend from client\dist"
