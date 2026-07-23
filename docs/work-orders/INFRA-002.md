# Trading Analysis Platform

## Work Order INFRA-002

### Permanent Windows Runtime Implementation

---

## Document Information

| Item                       | Value                                                           |
| -------------------------- | --------------------------------------------------------------- |
| Work Order                 | INFRA-002                                                       |
| Status                     | Ready for implementation                                        |
| Repository Location        | `docs/work-orders/INFRA-002.md`                                 |
| Governing Specification    | `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md` |
| Testing Standard           | `docs/testing/PERMANENT_INFRASTRUCTURE_TESTING.md`              |
| Production VPS Path        | `C:\trading-analysis-platform`                                  |
| Production Branch          | `final-core-operational-release`                                |
| Verified Production Commit | `5a446752a72e46612b49c92b88ddc8ca706e08b8`                      |
| Runtime Manager            | Windows Task Scheduler                                          |
| Frontend Production Mode   | React build served by Node backend                              |

---

## 1. Mandatory Reading

Before beginning, read and follow:

1. `AGENTS.md`
2. `docs/constitution/PROJECT_CONSTITUTION.md`
3. `docs/constitution/ARCHITECTURE_OVERVIEW.md`
4. `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md`
5. `docs/testing/PERMANENT_INFRASTRUCTURE_TESTING.md`
6. `docs/work-orders/INFRA-001.md`

---

## 2. Objective

Implement the permanent autonomous Windows runtime for the Trading Analysis Platform using the existing repository infrastructure.

The completed runtime must:

- start automatically after VPS reboot
- restart failed managed processes
- run without open PowerShell windows
- preserve existing production behaviour
- serve the built React frontend through the Node backend
- run the MT5 continuous bridge as a singleton
- maintain persistent logs
- validate required configuration
- support health checks
- support backup logging and retention
- support safe restore testing
- support controlled deployment and rollback
- preserve Tailscale-only private access

Do not introduce a competing process manager.

---

## 3. Confirmed Production Baseline

The implementation must use:

```text
VPS project root:
C:\trading-analysis-platform

Production branch:
final-core-operational-release

Verified production commit:
5a446752a72e46612b49c92b88ddc8ca706e08b8

Runtime manager:
Windows Task Scheduler

Frontend:
npm run build
client/dist served by Node backend

Bridge:
py -3.14 tools\mt5_bridge\mt5_candle_bridge.py --run-continuous

Bridge runtime root:
C:\ProgramData\TradingAnalysisPlatform\runtime
```

The current VPS repository is in detached HEAD state at the verified production commit.

Implementation must not silently switch branches during runtime setup.

Deployment logic must explicitly manage commit checkout and record the deployed commit.

---

## 4. Scope

### 4.1 Included

- production configuration validation
- backend managed scheduled task
- MT5 continuous bridge managed scheduled task
- health-check scheduled task
- daily backup scheduled task
- removal of separate Vite preview dependency from permanent runtime
- persistent logging
- log retention
- backup logging
- restore safety improvements
- deployment path correction
- deployment branch correction
- rollback consistency
- runtime operations documentation
- non-secret environment templates
- status/start/stop/restart commands
- duplicate-process prevention

### 4.2 Excluded

- trading logic changes
- EMA200 changes
- supply/demand changes
- signal logic changes
- symbol-mapping changes
- database schema changes
- broker credential changes
- Tailscale configuration changes
- firewall changes
- public internet exposure
- live trade execution
- research, backtesting, or learning features

---

## 5. Existing Infrastructure to Extend

Inspect and extend the existing files where suitable:

```text
deployment/windows-vps/start-platform.ps1
deployment/windows-vps/stop-platform.ps1
deployment/windows-vps/register-scheduled-tasks.ps1
deployment/windows-vps/health-check.ps1
deployment/windows-vps/backup-platform.ps1
deployment/windows-vps/restore-platform.ps1
deployment/windows-vps/deploy-production.ps1
deployment/windows-vps/rollback-production.ps1
deployment/windows-vps/verify-private-access.ps1
deployment/windows-vps/setup-platform.ps1
deployment/windows-vps/setup-tailscale.ps1
```

Do not create duplicate startup, deployment, backup, or health systems.

---

## 6. Required Runtime Topology

The permanent runtime must use:

```text
Windows
│
├── PostgreSQL Windows Service
├── Tailscale Windows Service
├── MetaTrader 5 desktop terminal
├── TradingAnalysisPlatform-Backend
├── TradingAnalysisPlatform-MT5ContinuousBridge
├── TradingAnalysisPlatform-HealthCheck
└── TradingAnalysisPlatform-DailyBackup
```

No separate permanent Vite preview task should remain.

The Node backend must serve `client/dist`.

---

## 7. Backend Runtime Requirements

Implement a dedicated backend scheduled task that:

- runs `npm start` from `C:\trading-analysis-platform\server`
- starts at Windows startup
- restarts after unexpected failure
- prevents duplicate instances
- writes stdout and stderr to persistent logs
- validates required backend configuration before start
- waits for PostgreSQL readiness
- supports clean stop and restart
- records process ownership safely
- does not require an interactive terminal

The backend must continue to use:

```text
node app.js
```

The existing health endpoint must remain available:

```text
GET http://127.0.0.1:5000/api/system/health
```

Do not change trading or API behaviour unless required strictly for infrastructure reliability.

---

## 8. Frontend Runtime Requirements

The production frontend must be built with:

```powershell
Set-Location C:\trading-analysis-platform\client
npm run build
```

The Node backend must serve:

```text
client/dist
```

Do not run `npm run preview` as a permanent production process.

Update health checks and operations documentation accordingly.

Preserve existing Tailscale phone access.

---

## 9. MT5 Bridge Runtime Requirements

The permanent bridge task must run:

```powershell
Set-Location C:\trading-analysis-platform
py -3.14 tools\mt5_bridge\mt5_candle_bridge.py --run-continuous
```

The task must:

- start automatically
- restart after failure
- prevent duplicate instances
- preserve singleton lock behaviour
- store lock/state files outside the Git working tree
- write persistent logs
- load production configuration securely
- wait/retry safely when MT5 or backend is unavailable
- avoid uncontrolled restart loops
- preserve MT5-only production evidence

Do not reintroduce separate permanent `--sync-all` and `--ticks` scheduled jobs.

---

## 10. Configuration Validation

Add a validation step before starting managed application tasks.

Validation must check required non-secret configuration names without printing values.

At minimum, validate:

### Backend

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `MT5_BRIDGE_SECRET`
- `MARKET_PROVIDER`

### Bridge

- `PLATFORM_API_BASE_URL`
- `MT5_BRIDGE_SECRET`

Validation must:

- fail clearly
- write an error log
- not expose secrets
- prevent dependent tasks from starting with incomplete configuration

---

## 11. Non-Secret Configuration Templates

Create safe templates where appropriate:

```text
server/.env.example
tools/mt5_bridge/mt5_bridge.local.example.json
```

Templates must:

- contain variable names only
- contain safe placeholders
- contain no real credentials
- document component ownership
- remain compatible with `.gitignore`

Do not commit production `.env` or local secret files.

---

## 12. Logging Requirements

Maintain persistent logs for:

- backend stdout
- backend stderr
- MT5 bridge
- health checks
- backup
- deployment
- rollback
- startup/configuration validation

Use the canonical production log root:

```text
C:\trading-analysis-platform\logs
```

Add log-retention handling so logs do not grow without limit.

Recommended initial retention:

- rotate or archive by date/size
- retain at least 14 days
- preserve deployment and rollback records longer where practical

Do not log secret values.

---

## 13. Health Check Requirements

Extend the existing health check to verify:

- PostgreSQL service
- Tailscale service
- MT5 process
- backend task/process
- backend health endpoint
- MT5 bridge task/process
- recent MT5 data freshness
- frontend availability through backend-served static files
- disk free space
- latest backup result

The health check must distinguish:

- healthy
- degraded
- failed
- stale data

Do not treat normal market closure as an ingestion failure without context.

---

## 14. Backup Requirements

Extend the existing backup system to:

- log each backup run
- report success or failure
- verify non-empty backup output
- preserve timestamped filenames/directories
- retain at least 14 daily backups
- prevent unlimited growth
- avoid exposing credentials

Use the existing `pg_dump` custom-format approach.

Do not change the production database schema.

---

## 15. Restore Safety Requirements

Harden the restore workflow so it is safe for testing.

The restore script or documentation must:

- support restore into a separate test database
- warn clearly before any production restore
- require explicit confirmation
- avoid defaulting silently to the production database
- document verification queries
- preserve production data

Do not perform a production restore during implementation.

---

## 16. Deployment Requirements

Align deployment with:

```text
Production path:
C:\trading-analysis-platform

Production branch:
final-core-operational-release
```

The deployment process must:

1. verify the repository path
2. verify the approved branch or explicit commit
3. detect local drift
4. preserve `.env` and local secret/config files
5. fetch the approved commit
6. install backend dependencies
7. install frontend dependencies
8. build the frontend
9. stop managed runtime safely
10. start managed runtime in dependency order
11. run health checks
12. record the deployed commit
13. preserve previous successful deployment metadata
14. stop on failure

Do not silently use the `production` branch unless explicitly approved in a future change.

---

## 17. Rollback Requirements

Align rollback with the same canonical path and branch policy.

Rollback must:

- identify the previous known-good commit
- preserve production data
- preserve secrets
- restore application code
- reinstall dependencies where required
- rebuild frontend
- restart managed tasks
- verify health
- record rollback outcome

Application rollback must not imply automatic database rollback.

---

## 18. Detached HEAD Handling

The VPS currently runs in detached HEAD state at the verified production commit.

This is acceptable for an exact-commit production deployment if it is intentional and documented.

The deployment scripts must:

- make the detached commit state explicit
- record the exact deployed commit
- avoid accidental local branch drift
- preserve rollback metadata
- prevent operators from assuming the VPS is tracking a mutable branch automatically

Do not manually checkout a branch as part of this work order unless the deployment design requires it and the change is clearly documented.

---

## 19. Documentation Deliverables

Create or update:

```text
docs/infrastructure/INFRA-001_AUDIT_AND_PLAN.md
docs/infrastructure/PRODUCTION_ENVIRONMENT_VARIABLES.md
docs/infrastructure/WINDOWS_RUNTIME_OPERATIONS.md
server/.env.example
tools/mt5_bridge/mt5_bridge.local.example.json
```

Update existing deployment documentation where it conflicts with the implemented runtime.

Document exact commands for:

- status
- start
- stop
- restart
- health check
- logs
- backup
- test restore
- deploy
- rollback
- current deployed commit

---

## 20. Required File Review

Before modifying, confirm whether each proposed file already exists.

Prefer extending existing files.

At completion, return:

- every created file
- every modified file
- purpose of each change
- configuration changes
- task names
- log paths
- operational commands
- risks and assumptions
- unresolved blockers

---

## 21. Acceptance Criteria

INFRA-002 implementation is complete when:

- backend has a managed restartable task
- separate Vite preview is removed from permanent runtime
- frontend is served through Node
- MT5 bridge has a managed singleton task
- configuration validation exists
- logs persist
- log retention exists
- health checks match final topology
- backup runs are logged
- restore testing is protected
- deployment uses `C:\trading-analysis-platform`
- deployment uses `final-core-operational-release` or explicit approved commit
- rollback remains available
- bridge lock/state files do not create deployment drift
- autonomous runtime verification passes without an open PowerShell window
- no secrets are committed
- no trading logic is changed
- one consolidated testing checklist is returned

---

## 22. Implementation Limits

Do not:

- run destructive database commands
- reset production
- restore over production
- change MT5 credentials
- change symbol mappings
- change Tailscale/firewall settings
- enable live execution
- begin INFRA-003
- perform VPS acceptance testing without the project owner following the consolidated checklist

---

## 23. Required Codex Output

After implementation, return:

1. implementation summary
2. exact changed-file list
3. exact Windows task names
4. exact runtime commands
5. exact log locations
6. configuration variable inventory
7. deployment and rollback behaviour
8. risks and assumptions
9. unresolved blockers
10. one complete consolidated testing checklist

Stop after implementation and wait for test evidence.

---

**End of Work Order INFRA-002**
