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
  param([string]$Name, [string]$Command, [Microsoft.Management.Infrastructure.CimInstance]$Trigger, [Microsoft.Management.Infrastructure.CimInstance]$Settings = $null)
  $action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$Command`""
  if (-not $Settings) { $Settings = New-ScheduledTaskSettingsSet }
  Register-ScheduledTask -TaskName "TradingAnalysisPlatform-$Name" -Action $action -Trigger $Trigger -Settings $Settings -Description "Trading Analysis Platform $Name" -Force | Out-Null
  Write-Host "PASS registered TradingAnalysisPlatform-$Name"
}

$startupCommand = if ($CloudflaredConfig) {
  "& '$ScriptRoot\start-platform.ps1' -RepoRoot '$RepoRoot' -CloudflaredConfig '$CloudflaredConfig'"
} else {
  "& '$ScriptRoot\start-platform.ps1' -RepoRoot '$RepoRoot'"
}

Register-PlatformTask -Name "BackendStartup" -Command $startupCommand -Trigger (New-ScheduledTaskTrigger -AtStartup)
$bridgeSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$bridgeLog = "C:\TradingAnalysisPlatform\logs"
$bridgeCommand = "New-Item -ItemType Directory -Force -Path '$bridgeLog' | Out-Null; Set-Location '$RepoRoot'; Write-Host 'TradingAnalysisPlatform:mt5-continuous-bridge'; & '$PythonLauncher' -3.14 '$RepoRoot\tools\mt5_bridge\mt5_candle_bridge.py' --run-continuous *>> '$bridgeLog\mt5-continuous-bridge.log'"
Register-PlatformTask -Name "MT5ContinuousBridge" -Command $bridgeCommand -Trigger (New-ScheduledTaskTrigger -AtLogOn) -Settings $bridgeSettings
@("TradingAnalysisPlatform-MT5BridgeCollection", "TradingAnalysisPlatform-MT5LiveTicks") | ForEach-Object {
  if (Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $_ -Confirm:$false }
}
Register-PlatformTask -Name "DailyBackup" -Command "& '$ScriptRoot\backup-platform.ps1' -BackupRoot '$BackupRoot'" -Trigger (New-ScheduledTaskTrigger -Daily -At 2am)
Register-PlatformTask -Name "HealthCheck" -Command "& '$ScriptRoot\health-check.ps1' -RepoRoot '$RepoRoot'" -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650))
