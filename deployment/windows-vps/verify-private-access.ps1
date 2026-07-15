param(
  [string]$BackendPort = "5000"
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0

function Report {
  param([string]$Level, [string]$Name, [string]$Detail)
  if ($Level -eq "FAIL") { $script:FailCount += 1 }
  Write-Host "$Level $Name - $Detail"
}

$tailscale = Get-Command "tailscale" -ErrorAction SilentlyContinue
if (-not $tailscale) {
  Report "FAIL" "tailscale" "CLI not installed"
  exit 2
}

$ip = (& $tailscale.Source ip -4 | Select-Object -First 1).Trim()
if (-not $ip) {
  Report "FAIL" "tailscale-ip" "No Tailscale IPv4 address"
  exit 2
}

Report "PASS" "tailscale-ip" $ip

try {
  $local = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/system/health" -TimeoutSec 10
  Report "PASS" "local-health" $local.application_status
} catch {
  Report "FAIL" "local-health" $_.Exception.Message
}

try {
  $private = Invoke-RestMethod -Uri "http://$($ip):$BackendPort/api/system/health" -TimeoutSec 10
  Report "PASS" "tailscale-health" $private.application_status
} catch {
  Report "FAIL" "tailscale-health" $_.Exception.Message
}

$postgresPublic = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -notin @("127.0.0.1", "::1") }
if ($postgresPublic) {
  Report "FAIL" "postgres-listener" "PostgreSQL is listening beyond localhost"
} else {
  Report "PASS" "postgres-listener" "localhost/private only"
}

if ($script:FailCount -gt 0) { exit 2 }
exit 0
