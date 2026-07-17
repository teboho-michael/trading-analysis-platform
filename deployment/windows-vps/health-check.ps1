param(
  [string]$BackendUrl = "http://127.0.0.1:5000",
  [string]$FrontendUrl = "http://127.0.0.1:4173",
  [string]$RepoRoot = "C:\trading-analysis-platform",
  [string]$LogRoot = "C:\trading-analysis-platform\logs"
)

$ErrorActionPreference = "Continue"
$script:FailCount = 0
$script:WarnCount = 0
$RequiredSymbols = @("BTCUSD", "XAUUSD", "USDJPY", "US500", "US100")

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$TranscriptPath = Join-Path $LogRoot ("health-check-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $TranscriptPath -Force | Out-Null

function Report {
  param([string]$Level, [string]$Name, [string]$Detail)
  if ($Level -eq "FAIL") { $script:FailCount += 1 }
  if ($Level -eq "WARN") { $script:WarnCount += 1 }
  Write-Host "$Level $Name - $Detail"
}

function Assert-Equal {
  param([string]$Name, $Actual, $Expected)
  if ($Actual -eq $Expected) { Report "PASS" $Name $Actual } else { Report "FAIL" $Name "expected $Expected, got $Actual" }
}

try {
  $health = Invoke-RestMethod -Uri "$BackendUrl/api/system/health" -TimeoutSec 10
  Assert-Equal "application-status" $health.application_status "available"
  Assert-Equal "database" $health.database_status "available"
  Assert-Equal "mt5-terminal" $health.mt5_terminal_status "available"
  Assert-Equal "mt5-ticks" $health.mt5_tick_status "available"
  Assert-Equal "mt5-candles" $health.mt5_candles "available"
  if ($health.degradation_reason_codes.Count -gt 0) { Report "FAIL" "core-degradation-reason-codes" ($health.degradation_reason_codes -join ",") } else { Report "PASS" "core-degradation-reason-codes" "none" }
  if ($health.continuous_bridge_status -eq "available") { Report "PASS" "continuous-bridge" $health.continuous_bridge_heartbeat } else { Report "FAIL" "continuous-bridge" $health.continuous_bridge_status }
  if ([int]$health.continuous_bridge_process_count -eq 1) { Report "PASS" "bridge-process-count" "exactly one" } else { Report "FAIL" "bridge-process-count" $health.continuous_bridge_process_count }
  if ($health.future_timestamp_violations.Count -gt 0) { Report "FAIL" "future-timestamps" $health.future_timestamp_violations.Count } else { Report "PASS" "future-timestamps" "none" }
  if ($health.stale_warnings.Count -gt 0) { Report "FAIL" "mt5-freshness" "$($health.stale_warnings.Count) stale warnings" } else { Report "PASS" "mt5-freshness" "freshness check returned no warnings" }
  $ticks = @($health.latest_tick_by_symbol)
  foreach ($symbol in $RequiredSymbols) {
    $tick = $ticks | Where-Object { $_.symbol -eq $symbol -or $_.platform_symbol -eq $symbol } | Select-Object -First 1
    if (-not $tick) {
      Report "FAIL" "tick-$symbol" "missing"
    } elseif (($tick.status -eq "live" -and $tick.is_fresh -eq $true) -or $tick.status -eq "market_closed") {
      Report "PASS" "tick-$symbol" $tick.status
    } else {
      Report "FAIL" "tick-$symbol" $tick.status
    }
  }
} catch {
  Report "FAIL" "backend" $_.Exception.Message
}

try {
  $frontend = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 10
  if ([int]$frontend.StatusCode -eq 200) { Report "PASS" "frontend" "HTTP 200" } else { Report "FAIL" "frontend" "HTTP $($frontend.StatusCode)" }
} catch {
  Report "FAIL" "frontend" $_.Exception.Message
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
  Write-Host "FAIL strict production health acceptance ($script:FailCount failure(s), $script:WarnCount warning(s))"
  Write-Host "Transcript: $TranscriptPath"
  Stop-Transcript | Out-Null
  exit 2
}
Write-Host "PASS strict production health acceptance ($script:WarnCount warning(s))"
Write-Host "Transcript: $TranscriptPath"
Stop-Transcript | Out-Null
exit 0
