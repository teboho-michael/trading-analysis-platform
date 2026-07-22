# Trading Analysis Platform

## Permanent Infrastructure Specification

### Version 1.0

---

## Document Information

| Item                | Value                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Document            | Permanent Infrastructure Specification                                                                 |
| Version             | 1.0                                                                                                    |
| Status              | Approved for implementation                                                                            |
| Repository Location | `docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md`                                        |
| Governing Documents | `AGENTS.md`, `docs/constitution/PROJECT_CONSTITUTION.md`, `docs/constitution/ARCHITECTURE_OVERVIEW.md` |
| Applies To          | Windows VPS production infrastructure                                                                  |

---

## 1. Purpose

This specification defines the production infrastructure required to operate the Trading Analysis Platform continuously, privately, safely, and independently from the Linux development machine.

The required outcome is a Windows VPS deployment that:

- starts automatically after reboot
- restarts failed application processes
- maintains MT5 connectivity
- runs the Python MT5 bridge continuously
- runs the Node.js backend continuously
- runs the React frontend continuously
- preserves PostgreSQL data
- produces structured logs
- creates automated backups
- supports health verification
- supports controlled deployment and rollback
- remains privately accessible through Tailscale

This specification does not authorize new trading intelligence, research, backtesting, learning, or live execution features.

---

## 2. Scope

### 2.1 Included

- Windows VPS runtime design
- service startup and recovery
- MT5 runtime dependency handling
- Python bridge runtime
- backend runtime
- frontend runtime
- PostgreSQL availability checks
- logging and retention
- health checks
- backup automation
- backup restoration procedure
- GitHub-to-VPS deployment
- rollback procedure
- production configuration validation
- Tailscale access validation
- operational documentation

### 2.2 Excluded

- changes to trading logic
- changes to EMA200 rules
- changes to supply/demand logic
- new signal logic
- new research features
- backtesting
- learning engine
- automated live trade execution
- public internet exposure
- replacement of PostgreSQL, MT5, Node.js, React, or Tailscale

---

## 3. Production Baseline

The implementation must preserve the current production baseline:

- Windows VPS
- project root: `C:\trading-analysis-platform`
- MetaTrader 5 connected to XM
- Python MetaTrader5 package
- Python MT5 bridge
- Node.js / Express backend
- PostgreSQL production database
- React / Vite frontend
- Tailscale private access
- production branch: `final-core-operational-release`
- known production commit: `5a44675`

The branch and commit must be verified before implementation.

---

## 4. Infrastructure Principles

The implementation must follow these principles:

1. Production reliability before convenience.
2. Minimal changes to working application code.
3. No unrelated refactoring.
4. No production secrets committed to Git.
5. MT5 remains the exclusive production market-data source.
6. Runtime failures must be visible in logs.
7. Every automated component must have a manual recovery procedure.
8. The system must survive VPS reboot without manual reconfiguration.
9. Production services must not depend on an interactive terminal remaining open.
10. The Linux development machine must not be required for daily operation.

---

## 5. Runtime Architecture

The production runtime must consist of the following managed components:

```text
Windows VPS
│
├── PostgreSQL Windows Service
├── MetaTrader 5 Desktop Terminal
├── MT5 Readiness / Session Check
├── Python MT5 Bridge Runtime
├── Node.js Backend Runtime
├── React Frontend Runtime
├── Health Monitoring Runtime
├── Backup Runtime
└── Tailscale Windows Service
```

The implementation may use an approved Windows process manager, Windows services, or Task Scheduler where appropriate.

The selected approach must:

- start without an interactive PowerShell window
- restart failed processes
- support clear service status inspection
- write persistent logs
- preserve environment configuration
- remain maintainable by the project owner

---

## 6. Service Dependency Order

The intended dependency order is:

1. Windows networking
2. Tailscale
3. PostgreSQL
4. MetaTrader 5
5. MT5 readiness confirmation
6. Node.js backend
7. Python MT5 bridge
8. React frontend
9. health monitoring

A dependent component must not begin destructive retry loops while its required dependency is unavailable.

Temporary dependency failure must produce logged retry behaviour rather than silent failure.

---

## 7. PostgreSQL Requirements

PostgreSQL must:

- run as a Windows service
- start automatically after reboot
- use the existing production database
- preserve the existing `trading_app` access model
- remain bound according to the current private production design
- reject unapproved public exposure
- produce database logs
- support automated logical backups
- support documented restoration

The implementation must not:

- recreate the production database
- reset existing tables
- delete production data
- alter schema unless explicitly authorized by a separate work order

---

## 8. MetaTrader 5 Requirements

MetaTrader 5 must:

- start automatically after Windows login or reboot using a supported operational method
- use the existing XM terminal/account configuration
- remain available to the Python MetaTrader5 package
- preserve current symbol visibility and broker mappings
- expose connection failure through monitoring
- support documented manual restart

The implementation must not:

- change broker credentials
- change account configuration
- alter broker symbol mappings without approval
- enable automated live execution

Because MT5 is a desktop application, the implementation must document any Windows session dependency clearly.

---

## 9. Python MT5 Bridge Requirements

The bridge must:

- run continuously without an open terminal
- use the existing bridge implementation
- load production configuration securely
- authenticate with the backend using the bridge secret
- retry transient MT5 or backend failures safely
- avoid uncontrolled duplicate processes
- write timestamped logs
- expose a clear success/failure state
- restart automatically after process failure
- restart automatically after VPS reboot
- stop cleanly during deployment or maintenance

The bridge must never introduce mock, proxy, synthetic, or non-MT5 production data.

---

## 10. Backend Requirements

The Node.js backend must:

- start automatically after VPS reboot
- restart after unexpected process failure
- load production environment variables securely
- connect to PostgreSQL
- accept authenticated MT5 bridge payloads
- expose a health endpoint
- bind only to the intended production interface
- write persistent logs
- preserve current application behaviour
- support graceful shutdown during deployment

The implementation must confirm the production health endpoint and document its expected response.

---

## 11. Frontend Requirements

The React frontend must:

- start automatically after VPS reboot
- restart after failure
- remain accessible through Tailscale
- use the correct backend API base URL
- avoid dependence on a manually opened terminal
- write runtime logs where applicable
- preserve current mobile access
- preserve current dashboard behaviour

The production method must be documented clearly.

The implementation may retain the current Vite preview model only if it is shown to be stable and intentionally approved. Otherwise, a static production build served by the existing backend or a lightweight approved static server may be used, provided the change remains within scope and preserves behaviour.

---

## 12. Process Management

The selected process-management solution must provide:

- named processes
- start
- stop
- restart
- status
- automatic restart
- boot persistence
- log paths
- predictable configuration
- prevention of duplicate instances

All process names and commands must be documented.

The solution must not require commercial tooling.

---

## 13. Health Monitoring

Monitoring must verify at minimum:

- PostgreSQL service status
- MT5 process status
- MT5 terminal connectivity
- backend process status
- backend health endpoint
- bridge process status
- freshness of recently ingested MT5 data
- frontend availability
- Tailscale service status
- disk free space
- latest backup status

Monitoring must distinguish between:

- healthy
- degraded
- failed
- stale market data
- planned market closure or maintenance where reasonably detectable

Monitoring output must be written to a persistent log.

---

## 14. Failure Handling

The system must define behaviour for:

- backend crash
- bridge crash
- frontend crash
- PostgreSQL unavailable
- MT5 unavailable
- XM connection unavailable
- Tailscale unavailable
- invalid production configuration
- disk space below threshold
- backup failure
- stale market data
- failed deployment

Failure handling must:

- avoid silent failure
- avoid uncontrolled restart loops
- preserve production data
- generate useful logs
- support manual recovery

---

## 15. Logging

Logs must be maintained for:

- backend
- Python bridge
- frontend runtime
- health monitor
- deployment
- backup
- restore attempts
- runtime startup
- critical failures

Each log entry should include:

- timestamp
- component
- severity
- event
- relevant error information

Logs must be stored outside temporary terminal output.

A retention policy must prevent unlimited disk growth.

Recommended initial retention:

- active logs rotated by size or day
- at least 14 days of normal operational logs
- longer retention for deployment and backup records where practical

Secrets must not be written to logs.

---

## 16. Backup Requirements

Automated PostgreSQL backups must:

- run on a defined schedule
- use PostgreSQL-supported backup tooling
- include the production database
- write to a dedicated backup directory
- use timestamped filenames
- log success or failure
- verify that the backup file exists and is non-empty
- apply retention
- avoid storing database passwords in committed scripts

Recommended initial schedule:

- daily logical backup
- retention of at least 14 daily backups
- optional weekly copies retained longer

Backup storage must not be limited to only one unverified file.

---

## 17. Restore Requirements

A documented restoration procedure must exist.

The restore procedure must state:

- prerequisites
- backup selection
- safe target database method
- restore command
- verification queries
- application reconnection checks
- rollback or abort steps

Restore testing must initially be performed against a separate test database, not directly against production.

A backup is not considered reliable until restoration has been demonstrated.

---

## 18. Deployment Requirements

Deployment must follow a controlled GitHub-to-VPS process.

The deployment process must:

1. verify the target branch
2. verify the current commit
3. preserve production environment files
4. fetch the approved commit
5. install required dependencies
6. build the frontend where required
7. apply only approved database migrations
8. restart managed services in the correct order
9. run health checks
10. record the deployed commit
11. stop and report on failure

Deployment must not silently overwrite secrets.

Direct production edits must be detected or documented before deployment.

---

## 19. Rollback Requirements

The rollback process must:

- identify the previously known-good commit
- preserve production data
- restore application code safely
- reinstall dependencies when necessary
- rebuild the frontend when necessary
- restart services
- verify health
- record the rollback

Database rollback is outside automatic application rollback unless a specific reversible migration plan exists.

---

## 20. Configuration Management

Production configuration must:

- remain outside Git
- be stored in known locations
- include a documented variable inventory without secret values
- be validated before service start
- fail clearly when required values are missing
- avoid duplicate conflicting configuration sources

A safe template such as `.env.example` may be committed, but it must contain no real secrets.

---

## 21. Security Requirements

The implementation must preserve:

- Tailscale-only private access
- no unnecessary public ports
- protected production secrets
- least-privilege database access where practical
- authenticated bridge ingestion
- no broker credentials in source code
- no database backups committed to Git
- no secrets written to logs

Firewall or public network changes require explicit approval.

---

## 22. Disk and Resource Management

The system must monitor and control:

- log growth
- backup growth
- frontend build artifacts
- temporary deployment files
- stale process files
- available disk space
- memory use where practical

The system must avoid uncontrolled accumulation of files.

---

## 23. Operational Commands

The completed implementation must document exact commands for:

- checking all service statuses
- starting all services
- stopping all services
- restarting all services
- viewing backend logs
- viewing bridge logs
- viewing frontend logs
- viewing monitoring logs
- running a manual backup
- testing a restore
- deploying a commit
- rolling back a commit
- checking the current deployed commit
- checking Tailscale status
- checking MT5 connectivity

---

## 24. Required Deliverables

Implementation must produce:

- runtime configuration files
- startup/restart configuration
- health-monitoring script or service
- backup script
- restore procedure
- deployment script
- rollback script or documented rollback command
- production operations documentation
- consolidated test evidence requirements
- changed-file report

Exact filenames may be selected after repository inspection.

Codex must extend existing scripts where suitable instead of creating unnecessary duplicates.

---

## 25. Acceptance Criteria

The permanent infrastructure phase is complete only when:

- the VPS can reboot and recover the full platform
- PostgreSQL starts automatically
- MT5 becomes available
- backend starts automatically
- bridge starts automatically
- frontend starts automatically
- failed managed processes restart
- duplicate process instances are prevented
- backend health is verifiable
- live MT5 data freshness is verifiable
- phone access through Tailscale works
- logs persist
- automated backups run
- backup retention works
- a backup restores successfully into a test database
- deployment works from an approved Git commit
- rollback to a known-good commit works
- no production secrets are committed
- one consolidated evidence package passes review

---

## 26. Implementation Sequence

The approved implementation order is:

1. repository and production audit
2. runtime/process-management decision
3. production configuration validation
4. backend managed runtime
5. frontend managed runtime
6. MT5 bridge managed runtime
7. MT5 readiness and recovery
8. health monitoring
9. logging and retention
10. backup automation
11. restore test
12. deployment automation
13. rollback validation
14. reboot recovery test
15. complete consolidated acceptance test

No advanced trading feature work may be included.

---

## 27. Authority

This specification is subordinate to:

1. `AGENTS.md`
2. `docs/constitution/PROJECT_CONSTITUTION.md`
3. `docs/constitution/ARCHITECTURE_OVERVIEW.md`

A work order may narrow implementation scope but may not contradict this specification.

---

**End of Permanent Infrastructure Specification v1.0**
