param(
  [string]$PlatformRoot = "C:\TradingAnalysisPlatform",
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$required = @(
  @{ Name = "Git"; Command = "git" },
  @{ Name = "Node.js"; Command = "node" },
  @{ Name = "npm"; Command = "npm" },
  @{ Name = "Python"; Command = "py" },
  @{ Name = "PostgreSQL psql"; Command = "psql" },
  @{ Name = "cloudflared"; Command = "cloudflared" }
)

Write-Host "TradingAnalysisPlatform setup check"
if ($ValidateOnly) {
  Write-Host "PASS validation mode: no folders will be created"
} else {
  New-Item -ItemType Directory -Force -Path $PlatformRoot, "$PlatformRoot\logs", "$PlatformRoot\backups", "$PlatformRoot\runtime" | Out-Null
}

foreach ($item in $required) {
  $found = Get-Command $item.Command -ErrorAction SilentlyContinue
  if ($found) {
    Write-Host "PASS $($item.Name): $($found.Source)"
  } else {
    Write-Host "FAIL $($item.Name): missing"
  }
}

$mt5Path = "${env:ProgramFiles}\MetaTrader 5\terminal64.exe"
if (Test-Path $mt5Path) {
  Write-Host "PASS MetaTrader 5: $mt5Path"
} else {
  Write-Host "WARN MetaTrader 5: terminal path not found; verify the broker terminal is installed"
}

Write-Host "No secrets were installed. Configure local environment variables or ignored local config files on the VPS."
