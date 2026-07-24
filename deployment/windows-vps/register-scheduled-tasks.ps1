param(
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$ScriptRoot = "C:\trading-analysis-platform\deployment\windows-vps",
  [string]$BackupRoot = "C:\trading-analysis-platform\backups",
  [string]$LogRoot = "C:\trading-analysis-platform\logs",
  [string]$RuntimeRoot = "C:\ProgramData\TradingAnalysisPlatform\runtime",
  [string]$CloudflaredConfig = "",
  [string]$InteractiveTaskUser = "Administrator"
)

$ErrorActionPreference = "Stop"
$PowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$PythonLauncher = (Get-Command "py" -ErrorAction Stop).Source
$NpmExe = (Get-Command "npm" -ErrorAction Stop).Source

function Assert-WindowsAbsolutePath {
  param([string]$Path, [string]$Name)
  if ($Path -notmatch "^[A-Za-z]:\\") {
    throw "$Name must be an absolute Windows path: $Path"
  }
}

Assert-WindowsAbsolutePath -Path $RepoRoot -Name "RepoRoot"
Assert-WindowsAbsolutePath -Path $ScriptRoot -Name "ScriptRoot"
Assert-WindowsAbsolutePath -Path $BackupRoot -Name "BackupRoot"
Assert-WindowsAbsolutePath -Path $LogRoot -Name "LogRoot"
Assert-WindowsAbsolutePath -Path $RuntimeRoot -Name "RuntimeRoot"
if ($CloudflaredConfig) {
  Assert-WindowsAbsolutePath -Path $CloudflaredConfig -Name "CloudflaredConfig"
}

New-Item -ItemType Directory -Force -Path $LogRoot, $BackupRoot, $RuntimeRoot | Out-Null

function Register-PlatformTask {
  param(
    [string]$Name,
    [string]$Command,
    [object[]]$Trigger,
    [Microsoft.Management.Infrastructure.CimInstance]$Principal,
    [Microsoft.Management.Infrastructure.CimInstance]$Settings = $null
  )
  $action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command `"$Command`""
  if (-not $Settings) { $Settings = New-ScheduledTaskSettingsSet }
  Register-ScheduledTask -TaskName "TradingAnalysisPlatform-$Name" -Action $action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Trading Analysis Platform $Name" -Force | Out-Null
  Write-Host "PASS registered TradingAnalysisPlatform-$Name"
}

$unattendedPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$bridgePrincipal = New-ScheduledTaskPrincipal -UserId $InteractiveTaskUser -LogonType Interactive -RunLevel Highest

$backendSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$backendCommand = "New-Item -ItemType Directory -Force -Path '$LogRoot' | Out-Null; Set-Location '$RepoRoot\server'; & '$ScriptRoot\validate-production-config.ps1' -Component Backend -RepoRoot '$RepoRoot' -LogRoot '$LogRoot'; Write-Host 'TradingAnalysisPlatform:backend'; & '$NpmExe' start 1>> '$LogRoot\backend.out.log' 2>> '$LogRoot\backend.err.log'"
Register-PlatformTask -Name "Backend" -Command $backendCommand -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $unattendedPrincipal -Settings $backendSettings

$bridgeSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$bridgeCommand = "New-Item -ItemType Directory -Force -Path '$LogRoot', '$RuntimeRoot' | Out-Null; Set-Location '$RepoRoot'; `$env:TRADING_ANALYSIS_RUNTIME_DIR = '$RuntimeRoot'; & '$ScriptRoot\validate-production-config.ps1' -Component Bridge -RepoRoot '$RepoRoot' -LogRoot '$LogRoot'; Write-Host 'TradingAnalysisPlatform:mt5-continuous-bridge'; & '$PythonLauncher' -3.14 '$RepoRoot\tools\mt5_bridge\mt5_candle_bridge.py' --run-continuous *>> '$LogRoot\mt5-continuous-bridge.log'"
Register-PlatformTask -Name "MT5ContinuousBridge" -Command $bridgeCommand -Trigger @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn)) -Principal $bridgePrincipal -Settings $bridgeSettings
@("TradingAnalysisPlatform-BackendStartup", "TradingAnalysisPlatform-Frontend", "TradingAnalysisPlatform-MT5BridgeCollection", "TradingAnalysisPlatform-MT5LiveTicks") | ForEach-Object {
  if (Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $_ -Confirm:$false }
}
Register-PlatformTask -Name "DailyBackup" -Command "Set-Location '$RepoRoot'; & '$ScriptRoot\backup-platform.ps1' -RepoRoot '$RepoRoot' -BackupRoot '$BackupRoot' -LogRoot '$LogRoot'" -Trigger (New-ScheduledTaskTrigger -Daily -At 2am) -Principal $unattendedPrincipal
Register-PlatformTask -Name "HealthCheck" -Command "Set-Location '$RepoRoot'; & '$ScriptRoot\health-check.ps1' -RepoRoot '$RepoRoot' -LogRoot '$LogRoot' -RuntimeRoot '$RuntimeRoot'" -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)) -Principal $unattendedPrincipal
