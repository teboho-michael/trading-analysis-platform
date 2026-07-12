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

if (-not $owned -and -not $tasks) {
  Write-Host "No platform-owned processes or scheduled tasks found"
}
