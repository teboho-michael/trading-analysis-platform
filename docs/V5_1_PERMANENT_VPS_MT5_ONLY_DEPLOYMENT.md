# V5.1 Permanent VPS MT5-Only Deployment

V5.1 moves the platform toward a permanent Windows VPS runtime. The laptop is development-only. The VPS runs the broker terminal, the MT5 candle sync, the backend, private access tooling, health checks, and backups.

## Data Policy

- Active market-data source: `mt5_broker`.
- Research evidence policy: MT5-only.
- Readiness, backtests, research intelligence, market conditions, pattern discovery, and experiments filter stored candles with `source = mt5_broker`.
- Legacy non-MT5 candles can remain for audit. They are not used as qualifying evidence.
- Missing MT5 data returns explicit `insufficient_data`, `missing_mt5_data`, `source_not_mt5`, `awaiting_mt5_sync`, or `stale_mt5_data` style statuses.
- No fallback, proxy, or fabricated price is used.

## Runtime Layout

```text
Windows VPS
  MetaTrader 5 desktop
  tools/mt5_bridge/mt5_candle_bridge.py --run-continuous
  Node backend on localhost
  React build served by the Node backend from client/dist
  PostgreSQL on localhost/private interface only
  Tailscale private access
  deployment/windows-vps/*.ps1
```

Internal services should bind to localhost or private interfaces. PostgreSQL must never be exposed publicly. Backend/frontend access should use Tailscale private networking for stable phone access.

## Startup And Recovery

1. Run `deployment/windows-vps/setup-platform.ps1` to verify prerequisites.
2. Configure secrets as local VPS environment variables or ignored local config files.
3. Run `deployment/windows-vps/start-platform.ps1`.
4. Register scheduled tasks with `deployment/windows-vps/register-scheduled-tasks.ps1`.
5. Use `deployment/windows-vps/health-check.ps1` after reboot and after any deployment.

To verify laptop independence, shut down the laptop and confirm from phone or another private device that the Tailscale private address reaches the platform and `/api/system/health` reports the VPS services.

## Backups And Restore

Use `deployment/windows-vps/backup-platform.ps1` for timestamped PostgreSQL dumps, backup manifests, retention, and backup logs. Backups belong outside Git and must not print secrets.

Restore tests use `deployment/windows-vps/restore-platform.ps1 -BackupFile <dump> -DatabaseName trading_analysis_restore_test -ConfirmRestore`. The restore script refuses the production database unless a separate production restore procedure explicitly supplies `-AllowProductionTarget`.

## Phone Access

Preferred production access:

- Tailscale private device access.

Do not publish an unauthenticated public website. Keep database access private and use the private access layer only for the application surface.

### Tailscale Setup

Run these steps on the Windows VPS:

```powershell
winget install tailscale.tailscale
tailscale up
.\deployment\windows-vps\setup-tailscale.ps1
.\deployment\windows-vps\verify-private-access.ps1
```

Install Tailscale on the phone, sign into the same tailnet, then open the printed private URL, for example `http://100.x.y.z:5000`. After shutting down the laptop, refresh the phone page and run:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/health"
```

After a VPS reboot, confirm scheduled tasks restarted the backend, candle sync, and live tick sync:

```powershell
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,State
.\deployment\windows-vps\verify-private-access.ps1
```

## Automatic Production Deployment

Production deployment uses a self-hosted GitHub Actions runner on the Windows VPS. The workflow is `.github/workflows/deploy-production.yml` and only runs from the `final-core-operational-release` branch.

Promotion flow:

```text
final-core-operational-release
→ review and test
→ automatic exact-commit VPS deployment
```

Install the runner without storing tokens in Git:

```powershell
.\deployment\windows-vps\install-github-runner.ps1 -RepoUrl "https://github.com/OWNER/REPO"
```

Use the one-time GitHub runner token interactively on the VPS. The deployment script preserves `.env` and local private config, checks the exact repo root, checks out the exact commit, installs dependencies, builds the frontend, runs the existing migration process when present, stops only platform-owned processes, restarts the platform, and fails if health checks fail.

Rollback uses the last recorded successful commit:

```powershell
.\deployment\windows-vps\rollback-production.ps1 -RepoRoot "C:\trading-analysis-platform"
```

## Verification

Run:

```powershell
.\deployment\windows-vps\health-check.ps1
```

Then check:

- `GET /api/system/health`
- `GET /api/system/data-sources`
- Latest MT5 candle timestamps for BTCUSD, XAUUSD, USDJPY, US500, and US100 on D1, H4, and H1.
- Daily backups exist outside Git.
- Reboot the VPS and confirm scheduled tasks restart the platform and MT5 collection.

## Manual VPS Validation Procedure

Run these steps on the Windows VPS after deployment or after changing scheduled tasks:

1. Open PowerShell as the deployment user.
2. Run setup validation without creating folders:

```powershell
.\deployment\windows-vps\setup-platform.ps1 -ValidateOnly
```

3. Register scheduled tasks:

```powershell
.\deployment\windows-vps\register-scheduled-tasks.ps1 -RepoRoot "C:\trading-analysis-platform" -ScriptRoot "C:\trading-analysis-platform\deployment\windows-vps" -BackupRoot "C:\trading-analysis-platform\backups" -LogRoot "C:\trading-analysis-platform\logs"
```

4. Start the platform:

```powershell
.\deployment\windows-vps\start-platform.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
```

5. Run a health check and record the exit code. `0` means PASS, `1` means WARN, and `2` means FAIL.

```powershell
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform"
$LASTEXITCODE
```

6. Confirm the continuous MT5 bridge command is the permanent bridge mode:

```powershell
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge" | Select-Object TaskName,State
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*mt5_candle_bridge.py*" -and $_.CommandLine -like "*--run-continuous*" } | Select-Object ProcessId,CommandLine
```

7. Verify the system health API locally:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/health"
```

8. Verify phone or browser access through Tailscale. Do not expose PostgreSQL or an unauthenticated public site.

9. Run a backup:

```powershell
.\deployment\windows-vps\backup-platform.ps1 -BackupRoot "C:\trading-analysis-platform\backups" -LogRoot "C:\trading-analysis-platform\logs"
```

10. Confirm the newest backup dump exists and is non-empty:

```powershell
Get-ChildItem "C:\trading-analysis-platform\backups" -Recurse -Filter "*.dump" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 FullName,Length,LastWriteTime
```

11. Inspect scheduled tasks and confirm only the expected permanent task names are present:

```powershell
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" |
  Select-Object TaskName,State
```

Expected permanent tasks are `TradingAnalysisPlatform-Backend`, `TradingAnalysisPlatform-MT5ContinuousBridge`, `TradingAnalysisPlatform-HealthCheck`, and `TradingAnalysisPlatform-DailyBackup`.

12. Reboot the VPS.

13. After reboot, confirm the backend, MT5 bridge schedule, database, and private access recover:

```powershell
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform"
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,State
Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/health"
```

14. Run `stop-platform.ps1` only as a controlled test window. It stops running scheduled task instances and processes whose command line contains the `TradingAnalysisPlatform:` marker.

```powershell
.\deployment\windows-vps\stop-platform.ps1
```
