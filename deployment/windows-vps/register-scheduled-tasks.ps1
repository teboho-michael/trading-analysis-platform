param(
  [string]$RepoRoot = "C:\TradingAnalysisPlatform\repo",
  [string]$ScriptRoot = "C:\TradingAnalysisPlatform\repo\deployment\windows-vps",
  [string]$BackupRoot = "C:\TradingAnalysisPlatform\backups",
  [string]$CloudflaredConfig = ""
)

$ErrorActionPreference = "Stop"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$PythonLauncher = (Get-Command "py" -ErrorAction Stop).Source

function Assert-WindowsAbsolutePath {
  param([string]$Path, [string]$Name)
  if ($Path -notmatch "^[A-Za-z]:\\") {
    throw "$Name must be an absolute Windows path: $Path"
  }
}

Assert-WindowsAbsolutePath -Path $RepoRoot -Name "RepoRoot"
Assert-WindowsAbsolutePath -Path $ScriptRoot -Name "ScriptRoot"
Assert-WindowsAbsolutePath -Path $BackupRoot -Name "BackupRoot"
if ($CloudflaredConfig) {
  Assert-WindowsAbsolutePath -Path $CloudflaredConfig -Name "CloudflaredConfig"
}

function Register-PlatformTask {
  param([string]$Name, [string]$Command, [Microsoft.Management.Infrastructure.CimInstance]$Trigger)
  $action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$Command`""
  Register-ScheduledTask -TaskName "TradingAnalysisPlatform-$Name" -Action $action -Trigger $Trigger -Description "Trading Analysis Platform $Name" -Force | Out-Null
  Write-Host "PASS registered TradingAnalysisPlatform-$Name"
}

$startupCommand = if ($CloudflaredConfig) {
  "& '$ScriptRoot\start-platform.ps1' -RepoRoot '$RepoRoot' -CloudflaredConfig '$CloudflaredConfig'"
} else {
  "& '$ScriptRoot\start-platform.ps1' -RepoRoot '$RepoRoot'"
}

Register-PlatformTask -Name "BackendStartup" -Command $startupCommand -Trigger (New-ScheduledTaskTrigger -AtStartup)
Register-PlatformTask -Name "MT5BridgeCollection" -Command "& '$PythonLauncher' '$RepoRoot\tools\mt5_bridge\mt5_candle_bridge.py' --sync-all" -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650))
Register-PlatformTask -Name "DailyBackup" -Command "& '$ScriptRoot\backup-platform.ps1' -BackupRoot '$BackupRoot'" -Trigger (New-ScheduledTaskTrigger -Daily -At 2am)
Register-PlatformTask -Name "HealthCheck" -Command "& '$ScriptRoot\health-check.ps1' -RepoRoot '$RepoRoot'" -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650))
