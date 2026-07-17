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
    Write-Host "PASS $Name already running"
    return
  }
  Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden
  Write-Host "PASS started $Name"
}

$postgres = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($postgres -and $postgres.Status -ne "Running") {
  Start-Service $postgres.Name
}
Write-Host "PASS PostgreSQL service checked; keep PostgreSQL bound to localhost/private interfaces only"

Start-OwnedProcess -Name "backend" -FilePath $PowerShellExe -Arguments "-NoProfile -ExecutionPolicy Bypass -Command `"Write-Host 'TradingAnalysisPlatform:backend'; & '$NpmExe' start`"" -WorkingDirectory (Join-Path $RepoRoot "server")

$bridgeTask = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
if (-not $bridgeTask) { throw "TradingAnalysisPlatform-MT5ContinuousBridge is not registered" }
if ($bridgeTask.State -ne "Running") { Start-ScheduledTask -TaskName $bridgeTask.TaskName }
Write-Host "PASS continuous MT5 bridge task checked"

if ($CloudflaredConfig -and (Test-Path $CloudflaredConfig)) {
  $CloudflaredExe = (Get-Command "cloudflared" -ErrorAction Stop).Source
  Start-OwnedProcess -Name "cloudflared" -FilePath $PowerShellExe -Arguments "-NoProfile -ExecutionPolicy Bypass -Command `"Write-Host 'TradingAnalysisPlatform:cloudflared'; & '$CloudflaredExe' tunnel --config '$CloudflaredConfig' run`"" -WorkingDirectory $RepoRoot
} else {
  Write-Host "WARN cloudflared config not supplied; Cloudflare diagnostic tunnel not started. Use Tailscale for stable private access."
}
