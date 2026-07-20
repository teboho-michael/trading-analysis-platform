param(
  [string]$RepoRoot = "C:\trading-analysis-platform"
)

$ErrorActionPreference = "Stop"

$tasks = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" -ErrorAction SilentlyContinue
foreach ($task in $tasks) {
  if ($task.State -eq "Running") {
    Write-Host "Stopping platform-owned scheduled task $($task.TaskName)"
    Stop-ScheduledTask -TaskName $task.TaskName
  }
}

$owned = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*TradingAnalysisPlatform:*" }
foreach ($process in $owned) {
  Write-Host "Stopping platform-owned process $($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -Force
}

$bridgeProcesses = @(Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and
  $_.CommandLine -like "*mt5_candle_bridge.py*" -and
  $_.CommandLine -like "*--run-continuous*"
})
foreach ($process in $bridgeProcesses) {
  Write-Host "Stopping platform MT5 bridge Python process $($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -Force
}

if (-not $owned -and -not $tasks -and @($bridgeProcesses).Count -eq 0) {
  Write-Host "No platform-owned processes or scheduled tasks found"
}
