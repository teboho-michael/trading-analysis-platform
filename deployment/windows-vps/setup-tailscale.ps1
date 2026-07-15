param(
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [switch]$VerifyOnly
)

$ErrorActionPreference = "Stop"

$tailscale = Get-Command "tailscale" -ErrorAction SilentlyContinue
if (-not $tailscale) {
  throw "Tailscale CLI was not found. Install Tailscale on the VPS, sign in interactively, then rerun this script."
}

$status = & $tailscale.Source status --json | ConvertFrom-Json
if (-not $status.Self) {
  throw "Tailscale is installed but this VPS is not signed in."
}

$ip = (& $tailscale.Source ip -4 | Select-Object -First 1).Trim()
if (-not $ip) {
  throw "No Tailscale IPv4 address is available."
}

Write-Host "PASS tailscale-vps $($status.Self.HostName) $ip"

if (-not $VerifyOnly) {
  Write-Host "INFO No auth keys or secrets are stored by this script. Use Tailscale login on the VPS or an external ephemeral key outside Git for unattended enrollment."
}

try {
  $health = Invoke-RestMethod -Uri "$BackendUrl/api/system/health" -TimeoutSec 10
  Write-Host "PASS backend-local $($health.application_status)"
} catch {
  Write-Host "WARN backend-local $($_.Exception.Message)"
}

Write-Host "INFO Phone URL: http://$($ip):5000"
Write-Host "INFO Keep PostgreSQL private. Do not open port 5432 publicly."
