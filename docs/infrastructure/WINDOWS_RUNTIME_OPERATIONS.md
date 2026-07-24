# Windows Runtime Operations

## Runtime Topology

- `TradingAnalysisPlatform-Backend`
- `TradingAnalysisPlatform-MT5ContinuousBridge`
- `TradingAnalysisPlatform-HealthCheck`
- `TradingAnalysisPlatform-DailyBackup`

PostgreSQL and Tailscale remain Windows services. MetaTrader 5 remains the desktop terminal required by the Python `MetaTrader5` package.

Normal operation does not require an open PowerShell window. PowerShell is only required for deployments, registration/maintenance commands, troubleshooting, and controlled validation.

Bridge runtime state and lock files are stored outside the Git working tree:

```text
C:\ProgramData\TradingAnalysisPlatform\runtime
```

## Register Tasks

```powershell
Set-Location C:\trading-analysis-platform
.\deployment\windows-vps\register-scheduled-tasks.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -ScriptRoot "C:\trading-analysis-platform\deployment\windows-vps" `
  -BackupRoot "C:\trading-analysis-platform\backups" `
  -LogRoot "C:\trading-analysis-platform\logs" `
  -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime"
```

`TradingAnalysisPlatform-Backend` starts at Windows startup as `SYSTEM` with `LogonType=ServiceAccount`, `RunLevel=Highest`, and restarts after unexpected failure. `TradingAnalysisPlatform-HealthCheck` and `TradingAnalysisPlatform-DailyBackup` also run as `SYSTEM` service-account tasks so they do not require Administrator to be logged on. `TradingAnalysisPlatform-MT5ContinuousBridge` intentionally remains `Administrator` with `LogonType=Interactive` because the Python MT5 package depends on the interactive MT5 desktop terminal session; it has startup and logon triggers, uses `MultipleInstances IgnoreNew`, keeps the Windows mutex singleton guard, and restarts after unexpected failure.

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
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,@{Name="UserId";Expression={$_.Principal.UserId}},@{Name="LogonType";Expression={$_.Principal.LogonType}},@{Name="RunLevel";Expression={$_.Principal.RunLevel}}
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
$env:TRADING_ANALYSIS_RUNTIME_DIR = "C:\ProgramData\TradingAnalysisPlatform\runtime"
py -3.14 C:\trading-analysis-platform\tools\mt5_bridge\mt5_candle_bridge.py --run-continuous
```

Health check command:

```powershell
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs" -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime" -BackupRoot "C:\trading-analysis-platform\backups"
```

Autonomous runtime verification:

```powershell
.\deployment\windows-vps\verify-autonomous-runtime.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -LogRoot "C:\trading-analysis-platform\logs" `
  -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime" `
  -BackupRoot "C:\trading-analysis-platform\backups" `
  -ExpectedCommit "<approved-commit>"
```

## Logs

- Backend stdout: `C:\trading-analysis-platform\logs\backend.out.log`
- Backend stderr: `C:\trading-analysis-platform\logs\backend.err.log`
- MT5 bridge: `C:\trading-analysis-platform\logs\mt5-continuous-bridge.log`
- Configuration validation: `C:\trading-analysis-platform\logs\config-validation-yyyyMMdd.log`
- Health checks: `C:\trading-analysis-platform\logs\health-check-yyyyMMdd-HHmmss.log`
- Autonomous runtime verification: `C:\trading-analysis-platform\logs\autonomous-runtime-yyyyMMdd-HHmmss.log`
- Backups: `C:\trading-analysis-platform\logs\backup-platform-yyyyMMdd-HHmmss-ffff.log`
- Deployments: `C:\trading-analysis-platform\logs\deploy-production-yyyyMMdd-HHmmss.log`
- Rollbacks: `C:\trading-analysis-platform\logs\rollback-production-yyyyMMdd-HHmmss.log`

## Backup And Test Restore

```powershell
.\deployment\windows-vps\backup-platform.ps1 -BackupRoot "C:\trading-analysis-platform\backups" -LogRoot "C:\trading-analysis-platform\logs"
.\deployment\windows-vps\restore-platform.ps1 -BackupFile "<backup.dump>" -DatabaseName "trading_analysis_restore_test" -ConfirmRestore -CreateTargetDatabase
```

`backup-platform.ps1` loads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` from approved environment variables or `server\.env`. It passes host, port, user, and database explicitly to `pg_dump` and supplies the password through the process `PGPASSWORD` environment variable only for the dump run. Password values must not be printed in transcripts or placed directly on the command line.

`restore-platform.ps1` uses the same approved database configuration for `createdb` and `pg_restore`. Use `-CreateTargetDatabase` only for a missing non-production restore target. Automatic creation of the configured production database is refused.

Do not restore into `trading_analysis` unless a separate production restore procedure has been approved.

## Deploy And Rollback

Deploy an approved commit:

```powershell
.\deployment\windows-vps\deploy-production.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -CommitSha "7fa3101ba2bc3180874b9f82df004e421967800c" `
  -ProductionBranch "final-core-operational-release" `
  -LogRoot "C:\trading-analysis-platform\logs"
```

Deployment removes only the approved legacy source-tree bridge lock artifact, `tools\mt5_bridge\mt5_continuous_bridge.lock`, before drift detection. Runtime lock/state files now live under `C:\ProgramData\TradingAnalysisPlatform\runtime`, so normal deployments do not require manual lock deletion. The deploy script still fails on real tracked or untracked source-code drift.

Rollback application code to the previous successful deployment:

```powershell
.\deployment\windows-vps\rollback-production.ps1 -RepoRoot "C:\trading-analysis-platform" -LogRoot "C:\trading-analysis-platform\logs"
```

Application rollback does not roll back the production database automatically.

## Controlled Reboot Acceptance

```powershell
Set-Location C:\trading-analysis-platform
git status
git rev-parse HEAD
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform" -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime"
.\deployment\windows-vps\verify-autonomous-runtime.ps1 -RepoRoot "C:\trading-analysis-platform" -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime" -ExpectedCommit "7fa3101ba2bc3180874b9f82df004e421967800c"
Restart-Computer
```

After Windows returns, do not open a persistent PowerShell runtime window. Use PowerShell only to collect evidence:

```powershell
Set-Location C:\trading-analysis-platform
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,State
Get-ScheduledTask -TaskName "TradingAnalysisPlatform-*" | Select-Object TaskName,@{Name="UserId";Expression={$_.Principal.UserId}},@{Name="LogonType";Expression={$_.Principal.LogonType}},@{Name="RunLevel";Expression={$_.Principal.RunLevel}}
Get-ScheduledTaskInfo -TaskName "TradingAnalysisPlatform-Backend"
Get-ScheduledTaskInfo -TaskName "TradingAnalysisPlatform-MT5ContinuousBridge"
.\deployment\windows-vps\health-check.ps1 -RepoRoot "C:\trading-analysis-platform" -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime"
.\deployment\windows-vps\verify-autonomous-runtime.ps1 -RepoRoot "C:\trading-analysis-platform" -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime" -ExpectedCommit "7fa3101ba2bc3180874b9f82df004e421967800c"
```

Expected: backend is reachable after boot without Administrator login, frontend returns HTTP 200 from the backend, PostgreSQL and Tailscale services are running, MT5 is available after the Administrator interactive MT5 session is present, exactly one continuous bridge process is running, bridge state is fresh, latest backup is valid, backend/health/backup principals are unattended-capable, bridge principal remains Administrator interactive, no task action embeds secret values or secret variable names, the deployed commit is correct, and `git status --porcelain --untracked-files=normal` reports no source drift.
