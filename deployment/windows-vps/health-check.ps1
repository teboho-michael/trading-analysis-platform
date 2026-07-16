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
  Report "PASS" "mt5-ticks" $health.mt5_tick_status
  if ($health.continuous_bridge_status -eq "available") { Report "PASS" "continuous-bridge" $health.continuous_bridge_heartbeat } else { Report "FAIL" "continuous-bridge" $health.continuous_bridge_status }
  if ([int]$health.continuous_bridge_process_count -eq 1) { Report "PASS" "bridge-process-count" "exactly one" } else { Report "FAIL" "bridge-process-count" $health.continuous_bridge_process_count }
  if ($health.future_timestamp_violations.Count -gt 0) { Report "FAIL" "future-timestamps" $health.future_timestamp_violations.Count } else { Report "PASS" "future-timestamps" "none" }
  if ($health.stale_warnings.Count -gt 0) { Report "WARN" "mt5-freshness" "$($health.stale_warnings.Count) stale warnings" } else { Report "PASS" "mt5-freshness" "freshness check returned no warnings" }
} catch {
  Report "FAIL" "backend" $_.Exception.Message
}

$tailscale = Get-Command "tailscale" -ErrorAction SilentlyContinue
if ($tailscale) { Report "PASS" "tailscale" "installed" } else { Report "WARN" "tailscale" "not installed" }

$drive = Get-PSDrive -Name C
if ($drive.Free -lt 10GB) { Report "WARN" "disk" "free space below 10GB" } else { Report "PASS" "disk" "$([math]::Round($drive.Free / 1GB, 2)) GB free" }

$os = Get-CimInstance Win32_OperatingSystem
$freeMemoryGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
if ($freeMemoryGb -lt 1) { Report "WARN" "memory" "$freeMemoryGb GB free" } else { Report "PASS" "memory" "$freeMemoryGb GB free" }

$state = Join-Path $RepoRoot "tools\mt5_bridge\mt5_bridge_state.json"
if (Test-Path $state) { Report "PASS" "bridge-last-success" "state file present" } else { Report "WARN" "bridge-last-success" "state file not found yet" }

$bridgeTask = Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" -ErrorAction SilentlyContinue
if (-not $bridgeTask) { Report "FAIL" "bridge-task" "not registered" } elseif ($bridgeTask.State -ne "Running") { Report "FAIL" "bridge-task" $bridgeTask.State } else { Report "PASS" "bridge-task" "running" }
$bridgeProcesses = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*TradingAnalysisPlatform:mt5-continuous-bridge*" -or $_.CommandLine -like "*mt5_candle_bridge.py*--run-continuous*" }
if (@($bridgeProcesses).Count -eq 1) { Report "PASS" "bridge-process" "exactly one process" } else { Report "FAIL" "bridge-process" "found $(@($bridgeProcesses).Count)" }

if ($script:FailCount -gt 0) {
  exit 2
}
if ($script:WarnCount -gt 0) {
  exit 1
}
exit 0
