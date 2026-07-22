# Windows Runtime Operations

## Runtime Topology

- `TradingAnalysisPlatform-Backend`
- `TradingAnalysisPlatform-MT5ContinuousBridge`
- `TradingAnalysisPlatform-HealthCheck`
- `TradingAnalysisPlatform-DailyBackup`

PostgreSQL and Tailscale remain Windows services. MetaTrader 5 remains the desktop terminal required by the Python `MetaTrader5` package.

## Register Tasks

```powershell
Set-Location C:\trading-analysis-platform
.\deployment\windows-vps\register-scheduled-tasks.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -ScriptRoot "C:\trading-analysis-platform\deployment\windows-vps" `
  -BackupRoot "C:\trading-analysis-platform\backups" `
  -LogRoot "C:\trading-analysis-platform\logs"
```

## Start, Stop, Restart

```powershell
.\deployment\windows-vps\start-platform.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
.\deployment\windows-vps\stop-platform.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
.\deployment\windows-vps\stop-platform.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
.\deployment\windows-vps\start-platform.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
```

## Status

```powershell
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,State
Get-ScheduledTaskInfo -TaskName "TradingAnalysisPlatform-Backend"
Get-ScheduledTaskInfo -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge"
Get-Service *postgres*
Get-Service Tailscale
Get-Process terminal64 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5000 -State Listen
Invoke-RestMethod http://127.0.0.1:5000/api/system/health
```

## Runtime Commands

Backend task command:

```powershell
Set-Location C:\trading-analysis-platform\server
npm start
```

Frontend production build command:

```powershell
Set-Location C:\trading-analysis-platform\client
npm run build
```

MT5 bridge task command:

```powershell
Set-Location C:\trading-analysis-platform
py -3.14 C:\trading-analysis-platform\tools\mt5_bridge\mt5_candle_bridge.py --run-continuous
```

Health check command:

```powershell
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs" -BackupRoot "C:\trading-analysis-platform\backups"
```

## Logs

- Backend stdout: `C:\trading-analysis-platform\logs\backend.out.log`
- Backend stderr: `C:\trading-analysis-platform\logs\backend.err.log`
- MT5 bridge: `C:\trading-analysis-platform\logs\mt5-continuous-bridge.log`
- Configuration validation: `C:\trading-analysis-platform\logs\config-validation-yyyyMMdd.log`
- Health checks: `C:\trading-analysis-platform\logs\health-check-yyyyMMdd-HHmmss.log`
- Backups: `C:\trading-analysis-platform\logs\backup-platform-yyyyMMdd-HHmmss-ffff.log`
- Deployments: `C:\trading-analysis-platform\logs\deploy-production-yyyyMMdd-HHmmss.log`
- Rollbacks: `C:\trading-analysis-platform\logs\rollback-production-yyyyMMdd-HHmmss.log`

## Backup And Test Restore

```powershell
.\deployment\windows-vps\backup-platform.ps1 -BackupRoot "C:\trading-analysis-platform\backups" -LogRoot "C:\trading-analysis-platform\logs"
.\deployment\windows-vps\restore-platform.ps1 -BackupFile "<backup.dump>" -DatabaseName "trading_analysis_restore_test" -ConfirmRestore
```

Do not restore into `trading_analysis` unless a separate production restore procedure has been approved.

## Deploy And Rollback

Deploy an approved commit:

```powershell
.\deployment\windows-vps\deploy-production.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -CommitSha "5a446752a72e46612b49c92b88ddc8ca706e08b8" `
  -ProductionBranch "final-core-operational-release" `
  -LogRoot "C:\trading-analysis-platform\logs"
```

Rollback application code to the previous successful deployment:

```powershell
.\deployment\windows-vps\rollback-production.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
```

Application rollback does not roll back the production database automatically.
