param(
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$RepoRoot = "C:\TradingAnalysisPlatform\repo"
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0
$script:WarnCount = 0

function Report {
  param([string]$Level, [string]$Name, [string]$Detail)
  if ($Level -eq "FAIL") { $script:FailCount += 1 }
  if ($Level -eq "WARN") { $script:WarnCount += 1 }
  Write-Host "$Level $Name - $Detail"
}

try {
  $health = Invoke-RestMethod -Uri "$BackendUrl/api/system/health" -TimeoutSec 10
  Report "PASS" "backend" $health.application_status
  Report "PASS" "database" $health.database_status
  if ($health.stale_data_warnings.Count -gt 0) { Report "WARN" "mt5-freshness" "$($health.stale_data_warnings.Count) stale symbol/timeframes" } else { Report "PASS" "mt5-freshness" "freshness check returned no warnings" }
} catch {
  Report "FAIL" "backend" $_.Exception.Message
}

$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cloudflared) { Report "PASS" "cloudflared" "running" } else { Report "WARN" "cloudflared" "not running" }

$drive = Get-PSDrive -Name C
if ($drive.Free -lt 10GB) { Report "WARN" "disk" "free space below 10GB" } else { Report "PASS" "disk" "$([math]::Round($drive.Free / 1GB, 2)) GB free" }

$os = Get-CimInstance Win32_OperatingSystem
$freeMemoryGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
if ($freeMemoryGb -lt 1) { Report "WARN" "memory" "$freeMemoryGb GB free" } else { Report "PASS" "memory" "$freeMemoryGb GB free" }

$state = Join-Path $RepoRoot "tools\mt5_bridge\mt5_bridge_state.json"
if (Test-Path $state) { Report "PASS" "bridge-last-success" "state file present" } else { Report "WARN" "bridge-last-success" "state file not found yet" }

if ($script:FailCount -gt 0) {
  exit 2
}
if ($script:WarnCount -gt 0) {
  exit 1
}
exit 0
