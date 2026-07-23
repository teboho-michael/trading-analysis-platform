# Trading Analysis Platform

## Permanent Infrastructure Testing Standard

### Version 1.0

---

## Document Information

| Item                    | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Document                | Permanent Infrastructure Testing                                |
| Version                 | 1.0                                                             |
| Status                  | Active                                                          |
| Repository Location     | `docs/testing/PERMANENT_INFRASTRUCTURE_TESTING.md`              |
| Governing Specification | `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md` |

---

## 1. Purpose

This document defines the consolidated evidence required to approve the permanent Windows VPS infrastructure.

Testing must not be delivered as repeated one-step instructions.

For each implementation work order, Codex must provide one complete checklist containing all required commands, screenshots, API checks, logs, and expected results.

The project owner will collect the complete evidence package before analysis begins.

---

## 2. Testing Rules

1. Test the exact approved commit.
2. Record the current Git branch and commit.
3. Do not expose secrets in screenshots or terminal output.
4. Do not reset or delete production data.
5. Do not test restoration directly over the production database.
6. Do not change broker credentials or symbol mappings.
7. Collect all requested evidence before requesting diagnosis.
8. Mark each result as `PASS`, `FAIL`, or `NOT TESTED`.
9. Preserve raw error output for failed checks.
10. Use one evidence package per work order.

---

## 3. Evidence Package Header

Every test submission must begin with:

```text
Date:
VPS hostname:
Windows version:
Repository path:
Git branch:
Git commit:
Work order:
Tester:
```

---

## 4. Repository Verification

Required commands:

```powershell
Set-Location C:\trading-analysis-platform
git status
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
```

Expected:

- correct production branch
- approved commit
- no unexplained modified production files
- no secrets tracked by Git

Required evidence:

- terminal screenshot or copied output

---

## 5. Windows Service and Process Verification

Collect status for:

- PostgreSQL
- Tailscale
- MetaTrader 5
- backend
- frontend
- Python bridge
- health monitor
- backup scheduler

Required evidence:

- command output showing status
- Task Scheduler or service-manager screenshot where applicable
- confirmation that duplicate application instances are not running
- confirmation that managed task actions use noninteractive PowerShell and do not require an open console window

Expected:

- required components running
- startup type or scheduled trigger configured
- no restart loop
- no duplicate process
- backend and continuous bridge restart settings configured
- normal operation continues without a manually opened PowerShell window

---

## 6. PostgreSQL Verification

Required checks:

- PostgreSQL service is running
- production database exists
- application user can connect
- key tables remain present
- recent candle records exist
- database was not reset

Example commands must be adapted to the installed PostgreSQL path and secure credential method:

```powershell
Get-Service *postgres*
```

```sql
SELECT current_database();
SELECT now();
SELECT COUNT(*) FROM candles;
```

Required evidence:

- service output
- successful connection output
- non-sensitive query results

Expected:

- `trading_analysis` available
- existing data preserved
- application connectivity working

---

## 7. Backend Verification

Required checks:

- managed process is running
- correct port is listening
- health endpoint responds
- PostgreSQL connection succeeds
- application logs contain no unresolved startup error

Example checks:

```powershell
Get-NetTCPConnection -State Listen
Invoke-RestMethod http://127.0.0.1:5000/<health-route>
```

Use the verified health route from the repository.

Required evidence:

- process status
- listening port output
- health response
- latest backend log section

Expected:

- healthy response
- no missing environment variables
- no database authentication failure
- no repeated crash/restart cycle

---

## 8. MetaTrader 5 Verification

Required checks:

- MT5 process is running
- XM connection is active
- intended account/server is configured
- expected symbols are available
- terminal remains connected after runtime restart

Required evidence:

- MT5 screenshot with account number partially masked
- connection indicator
- Market Watch symbols
- process status output

Expected:

- connected XM terminal
- required broker symbols visible
- no live execution automation enabled by this infrastructure work

---

## 9. Python Bridge Verification

Required checks:

- bridge managed process is running
- only one bridge instance exists
- bridge lock/state files are stored outside the Git working tree
- MetaTrader5 initialization succeeds
- backend authentication succeeds
- recent sync succeeds
- failures are logged
- bridge restarts after controlled process termination

Required evidence:

- process status
- latest bridge log
- recent successful synchronization output
- restart test output

Expected:

- no `401` bridge-secret error
- no uncontrolled `413` payload error
- no unresolved symbol-mapping failure
- no duplicate bridge process
- recent MT5 candles received by backend
- no `tools\mt5_bridge\mt5_continuous_bridge.lock` file remains in the Git working tree

---

## 10. Market Data Freshness Verification

Verify recent MT5-derived data for:

- US500
- US100
- XAUUSD
- BTCUSD
- USDJPY

Verify applicable timeframes:

- D1
- H4
- H1

Required evidence:

- API output or database query showing latest candle timestamps
- backend or bridge log showing source as MT5
- dashboard screenshot showing current data

Expected:

- production evidence derives only from MT5
- no Twelve Data or proxy data mixed into the production path
- timestamps reasonably reflect market/session availability

Market closure must be distinguished from ingestion failure.

---

## 11. Frontend Verification

Required checks:

- frontend managed process or static server is running
- correct port is listening
- dashboard loads locally on the VPS
- dashboard loads through Tailscale on the phone
- frontend reaches the intended backend
- no blocking browser console errors
- current analysis is displayed

Required evidence:

- VPS browser screenshot
- phone screenshot through Tailscale
- process status
- frontend log where applicable
- browser console screenshot only if errors exist

Expected:

- dashboard accessible
- no public internet exposure required
- live MT5-derived data displayed
- existing UI functionality preserved

---

## 12. Tailscale Verification

Required checks:

```powershell
tailscale status
tailscale ip -4
```

Required evidence:

- Tailscale status output with sensitive details masked where needed
- phone-access screenshot

Expected:

- VPS connected to the intended tailnet
- approved device can reach the frontend
- access does not require exposing application ports publicly

---

## 13. Logging Verification

Verify logs exist for:

- backend
- bridge
- frontend runtime
- health monitor
- backup
- deployment
- runtime startup

Required evidence:

- directory listing
- latest lines from each log
- log rotation or retention configuration

Expected:

- timestamps present
- errors readable
- no secret values
- no unlimited single-file growth design
- logs survive terminal closure

---

## 14. Automatic Restart Verification

Perform controlled restart tests individually for:

- backend
- frontend
- bridge
- health monitor

Method:

1. record process ID
2. terminate only the target process
3. wait for configured restart interval
4. confirm a new process ID
5. verify health
6. inspect logs

Required evidence:

- before and after process status
- restart log
- successful health check

Expected:

- process returns automatically
- no duplicate process
- dependent components recover
- production data remains intact

---

## 15. VPS Reboot Recovery Verification

This is a mandatory final test.

Before reboot:

- confirm all services healthy
- record current commit
- record latest candle timestamp
- confirm latest backup

After reboot:

- wait for configured startup window
- verify PostgreSQL
- verify Tailscale
- verify MT5
- verify backend
- verify bridge
- verify frontend
- verify health monitor
- verify data freshness
- verify phone access

Required evidence:

- pre-reboot status
- reboot time
- post-reboot process/service status
- health response
- bridge log
- dashboard screenshot
- phone screenshot

Expected:

- no manual terminal startup required
- full system returns in documented dependency order
- no duplicate processes
- no lost production data

---

## 16. Backup Verification

Required checks:

- scheduled backup task exists
- manual backup succeeds
- backup filename contains timestamp
- backup file is non-empty
- backup log reports success
- retention policy is configured

Required evidence:

- scheduler/service screenshot
- backup command output
- backup directory listing
- file size
- backup log

Expected:

- production database backup created
- secrets not visible
- old backups handled according to retention policy

---

## 17. Restore Verification

Restore must use a separate test database.

Required procedure:

1. select a recent backup
2. create an isolated test database
3. restore into the test database
4. run verification queries
5. compare key table presence and representative counts
6. remove the test database only after evidence is captured and approval allows cleanup

Required evidence:

- selected backup
- restore command output
- verification queries
- table/count results
- restore log

Expected:

- successful restore
- production database untouched
- application schema and representative data present

---

## 18. Deployment Verification

Required checks:

- deployment starts from a clean, approved Git state
- target branch and commit are explicit
- production secrets remain untouched
- approved runtime artifacts do not cause deployment drift
- real source-code drift still blocks deployment
- dependencies install successfully
- frontend build succeeds where applicable
- services restart in order
- health checks pass
- deployed commit is recorded

Required evidence:

- deployment command
- deployment log
- pre/post commit
- service status
- health response
- dashboard screenshot

Expected:

- approved commit deployed
- no direct code drift
- no manual bridge lock deletion required
- no lost data
- no secret overwrite

## 18.1 Autonomous Runtime Verification

Required command:

```powershell
.\deployment\windows-vps\verify-autonomous-runtime.ps1 `
  -RepoRoot "C:\trading-analysis-platform" `
  -LogRoot "C:\trading-analysis-platform\logs" `
  -RuntimeRoot "C:\ProgramData\TradingAnalysisPlatform\runtime" `
  -BackupRoot "C:\trading-analysis-platform\backups" `
  -ExpectedCommit "<approved-commit>"
```

Required evidence:

- command output
- latest autonomous-runtime log
- Task Scheduler screenshot or command output for the four `TradingAnalysisPlatform-*` tasks

Expected:

- backend health passes
- frontend HTTP 200 passes
- PostgreSQL service passes
- MT5 process passes
- exactly one bridge process passes
- bridge freshness passes
- scheduled task checks pass
- latest backup passes
- Tailscale service passes or is explicitly explained if unavailable
- deployed Git commit matches
- no tracked or untracked source drift
- no source-tree bridge lock exists
- task actions are noninteractive and secret-free

---

## 19. Rollback Verification

Required checks:

- previous known-good commit identified
- application code rolled back
- dependencies/build handled
- services restarted
- health verified
- data preserved
- rollback logged

Required evidence:

- before/after commit
- rollback command or script output
- service status
- health response
- dashboard screenshot

Expected:

- previous version restored
- database remains intact
- system returns to healthy state

---

## 20. Disk and Resource Verification

Required checks:

```powershell
Get-PSDrive C
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 20
```

Required evidence:

- free disk space
- major process memory use
- log directory size
- backup directory size

Expected:

- sufficient free disk space
- no uncontrolled log or backup growth
- no obvious duplicate high-memory application processes

---

## 21. Security Verification

Confirm:

- `.env` files are not tracked
- production secrets are absent from Git history under current scope
- bridge ingestion requires authentication
- unnecessary public ports are not exposed
- Tailscale remains the normal access path
- logs do not reveal secrets
- database backups are not committed

Required evidence:

- relevant `git status` / `git ls-files` output
- listening-port output
- safe configuration checks

Do not print actual secret values.

---

## 22. Final Dashboard Evidence

Provide screenshots showing:

- frontend loaded on VPS
- frontend loaded on phone through Tailscale
- all five primary symbols
- D1/H4/H1 data where displayed
- EMA200/bias information
- supply/demand information
- `BUY`, `SELL`, or `WAIT` output
- Paper Demo area
- recent update timestamp

The purpose is to prove infrastructure changes did not break current functionality.

---

## 23. Final Result Matrix

Submit this completed table:

| Area                 | Result    | Evidence Reference | Notes |
| -------------------- | --------- | ------------------ | ----- |
| Git state            | PASS/FAIL |                    |       |
| PostgreSQL           | PASS/FAIL |                    |       |
| MT5                  | PASS/FAIL |                    |       |
| Backend              | PASS/FAIL |                    |       |
| Bridge               | PASS/FAIL |                    |       |
| Frontend             | PASS/FAIL |                    |       |
| Tailscale            | PASS/FAIL |                    |       |
| Data freshness       | PASS/FAIL |                    |       |
| Logging              | PASS/FAIL |                    |       |
| Process restart      | PASS/FAIL |                    |       |
| VPS reboot recovery  | PASS/FAIL |                    |       |
| Backup               | PASS/FAIL |                    |       |
| Restore              | PASS/FAIL |                    |       |
| Deployment           | PASS/FAIL |                    |       |
| Rollback             | PASS/FAIL |                    |       |
| Security             | PASS/FAIL |                    |       |
| Dashboard regression | PASS/FAIL |                    |       |

---

## 24. Approval Rule

The permanent infrastructure phase is approved only after:

- all mandatory checks pass
- failed checks are resolved
- restore testing passes
- reboot recovery passes
- phone access passes
- production functionality remains intact
- the complete evidence package has been reviewed

---

**End of Permanent Infrastructure Testing Standard v1.0**
