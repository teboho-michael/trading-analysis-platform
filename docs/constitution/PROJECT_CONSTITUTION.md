# Trading Analysis Platform

## Project Constitution

### Version 1.0

---

## Document Information

| Item                | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Document            | Trading Analysis Platform Project Constitution         |
| Version             | 1.0                                                    |
| Status              | Active                                                 |
| Authority           | Highest Project Authority                              |
| Repository Location | `docs/constitution/PROJECT_CONSTITUTION.md`            |
| Applies To          | Entire Trading Analysis Platform                       |
| Audience            | Project Owner, Codex, ChatGPT, and future contributors |

---

## 1. Purpose

This Constitution establishes the permanent governing principles of the Trading Analysis Platform.

It defines the architectural direction, engineering standards, development philosophy, operational rules, and decision-making framework for the project.

Every future specification, implementation task, architecture decision, work order, testing document, and engineering change must conform to this Constitution unless this Constitution is formally updated.

This document exists to preserve long-term consistency regardless of who performs implementation work or when that work occurs.

---

## 2. Project Vision

The Trading Analysis Platform shall become a private, production-grade quantitative trading research and analysis system.

Its primary objective is to analyse financial markets using objective, measurable evidence rather than subjective opinion.

The platform shall evolve into a reliable environment capable of:

- collecting broker market data
- performing structured technical analysis
- generating evidence-based trading opportunities
- supporting controlled paper trading
- supporting future quantitative research
- supporting future backtesting
- supporting future pattern discovery
- supporting future learning systems
- supporting future execution only after sufficient validation

The platform is intended for long-term private use.

It is not intended for sale and is not designed as a commercial software-as-a-service product.

---

## 3. Long-Term Objectives

1. Build an always-available production environment.
2. Build an evidence-based trading analysis engine.
3. Build a research environment capable of discovering repeatable market behaviour.
4. Build a backtesting environment capable of validating trading hypotheses.
5. Build a continuously improving quantitative research system.
6. Build infrastructure capable of supporting future automation.
7. Maintain production reliability while expanding analytical capability.
8. Preserve clear separation between research, analysis, infrastructure, and future execution.

---

## 4. Core Engineering Principles

### 4.1 Production First

Production stability takes precedence over new functionality.

A stable production platform is more valuable than unfinished or unreliable features.

### 4.2 Evidence Before Opinion

Trading decisions must be based on measurable market evidence.

No signal shall exist merely because a chart appears attractive.

Every conclusion must originate from observable and verifiable market data.

### 4.3 Simplicity Before Complexity

When two solutions satisfy the same objective, the simpler maintainable solution shall be preferred.

Complexity must provide a measurable operational or analytical benefit.

### 4.4 Reliability Before Automation

Automation must never reduce platform reliability.

Automatic behaviour must remain observable, testable, recoverable, and documented.

### 4.5 One Source of Truth

Every important architectural decision must have one authoritative definition.

Duplicate rules, competing implementations, and conflicting configuration systems are prohibited.

### 4.6 Controlled Evolution

The platform shall evolve through small, traceable, reviewable changes.

Large uncontrolled rewrites are prohibited unless explicitly approved.

### 4.7 Separation of Concerns

Infrastructure, market data, analysis, research, backtesting, learning, frontend presentation, and future execution must remain clearly separated.

---

## 5. Production Architecture

The permanent production architecture shall consist of:

- Windows VPS
- PostgreSQL
- MetaTrader 5
- Python MT5 bridge
- Node.js / Express backend
- React / Vite frontend
- Tailscale secure private access

These components collectively form the permanent production environment.

No alternative production architecture shall exist without formal architectural approval.

---

## 6. Market Data Policy

MetaTrader 5 broker data is the exclusive source of production market data.

This applies to:

- live market analysis
- historical storage
- research
- backtesting
- pattern discovery
- signal generation
- future learning evidence
- future readiness validation

Twelve Data or any other external market-data provider must not contribute to production or research evidence.

A development fallback may exist only if it is clearly disabled by default, clearly separated from production, clearly labelled as development-only, and prevented from mixing with MT5-derived evidence.

Production and development market data must never be mixed.

---

## 7. Environment Policy

### 7.1 Development Environment

The Linux workstation is the permanent development environment.

It is used for source-code development, debugging, local testing, Git operations, branch management, Codex implementation work, and preparation of deployment changes.

The development machine must not be required for daily production operation.

### 7.2 Production Environment

The Windows VPS is the permanent production environment.

It is used for MetaTrader 5, PostgreSQL, the Python MT5 bridge, backend runtime, frontend runtime, health monitoring, logging, backups, deployment, secure remote access, and continuous operation.

The production environment must operate independently of the Linux development machine.

---

## 8. Technology Stack

| Layer                        | Technology                 |
| ---------------------------- | -------------------------- |
| Frontend                     | React + Vite               |
| Backend                      | Node.js + Express          |
| Database                     | PostgreSQL                 |
| Market Data                  | MetaTrader 5               |
| MT5 Integration              | Python MetaTrader5 package |
| Production Operating System  | Windows                    |
| Development Operating System | Linux                      |
| Private Remote Access        | Tailscale                  |
| Source Control               | Git and GitHub             |

Replacement of these technologies requires formal architectural approval.

---

## 9. Repository Principles

Every repository modification must be minimal, necessary, traceable, reversible, documented, and consistent with existing architecture.

Unrelated refactoring is prohibited.

Large-scale rewrites require explicit approval.

Existing working components should be extended before new competing components are created.

---

## 10. Protected Areas

Protected components include:

- trading logic
- EMA200 logic
- higher-timeframe bias logic
- supply and demand logic
- signal generation
- risk calculations
- research engine
- learning engine
- backtesting engine
- database schema
- market-data normalization
- symbol mappings
- production credentials
- environment files
- deployment services
- Tailscale configuration
- production backups

Protected components must not be modified unless the assigned work order explicitly requires those changes.

---

## 11. Development Rules

Every implementation must:

1. inspect the existing repository before modifying it
2. read the applicable project documentation
3. identify affected files before changing them
4. preserve existing behaviour unless instructed otherwise
5. minimise implementation scope
6. avoid duplicate services, routes, models, scripts, and configuration systems
7. avoid unnecessary dependencies
8. explain every modified file
9. justify every new file
10. report risks, assumptions, and blockers
11. stop rather than guess when requirements conflict
12. protect secrets and production data

---

## 12. Codex Rules

Every Codex implementation must:

- follow `AGENTS.md`
- follow this Constitution
- follow the relevant subsystem specification
- implement only the approved work order
- inspect before modifying
- preserve production behaviour
- avoid unrelated refactoring
- avoid silent architectural redesign
- stop on genuine blockers
- report conflicts clearly
- return a changed-file report
- return one consolidated testing checklist
- wait for approval before beginning the next work order

---

## 13. Testing Standard

Every implementation must finish with one complete testing package.

Testing must include, where applicable:

- required terminal commands
- API requests
- database verification
- service-status checks
- log verification
- dashboard evidence
- required screenshots
- expected results
- pass/fail criteria

Testing must not be delivered as repeated one-step instructions.

The complete evidence package must be collected before diagnosis or further implementation begins.

---

## 14. Documentation Standard

Every major subsystem must have its own engineering specification.

Examples include:

- Permanent Infrastructure Specification
- Trading Intelligence Specification
- Research Engine Specification
- Backtesting Specification
- Learning Engine Specification
- Execution Engine Specification
- Security Specification
- Database Specification
- API Specification
- Frontend Specification
- Deployment Specification

Specifications inherit authority from this Constitution.

They may add detail but may not contradict it.

---

## 15. Documentation Hierarchy

Project documents apply in this order:

1. `AGENTS.md`
2. `docs/constitution/PROJECT_CONSTITUTION.md`
3. `docs/constitution/ARCHITECTURE_OVERVIEW.md`
4. relevant subsystem specification
5. approved architecture decision records
6. current work order
7. testing documentation
8. existing implementation documentation
9. source code and tests

A lower-level document may narrow scope but may not override a higher-level document.

---

## 16. Change Control

Architectural decisions must not be changed silently.

Any major architectural change requires documented justification, impact assessment, explicit project-owner approval, a Constitution version update where applicable, an Architecture Decision Record update, corresponding specification updates, and migration and rollback planning.

---

## 17. Architecture Decision Log — Version 1.0

1. MT5 broker data is the exclusive production and research market-data source.
2. Twelve Data must not contribute to quantitative evidence.
3. Windows VPS is the permanent production environment.
4. Linux is the permanent development environment.
5. Production infrastructure must be completed before advanced trading intelligence.
6. The Trading Analysis Platform is a private long-term system and is not intended for sale.
7. Reliability takes priority over feature expansion.
8. One production architecture shall exist.
9. Every major subsystem shall have its own specification.
10. Codex work shall be controlled through small work orders.
11. Testing shall be consolidated into one complete evidence package.
12. Automated live execution is not authorized until a dedicated execution specification is approved.

---

## 18. Infrastructure Priority

The immediate project priority is permanent autonomous Windows runtime.

This includes automatic startup, automatic restart, MT5 recovery, bridge recovery, backend runtime, frontend runtime, health monitoring, logs, backups, secure remote access, deployment, rollback, and operational reliability.

Advanced trading intelligence, research, backtesting, learning, and execution must not displace this priority.

---

## 19. Trading Intelligence Boundary

Current trading analysis includes:

- D1 bias
- H4 bias
- H1 trend
- EMA200 analysis
- supply and demand zones
- `BUY`, `SELL`, or `WAIT`
- risk structure
- Paper Demo

Future enhancement of these capabilities requires a dedicated Trading Intelligence Specification.

Infrastructure work must not silently alter trading behaviour.

---

## 20. Execution Boundary

The current platform does not authorize automated live trade execution.

Any future execution capability requires a dedicated Execution Engine Specification, explicit risk controls, order validation, account protection, position-sizing rules, maximum-loss controls, kill switches, extensive paper testing, backtesting, forward testing, and explicit project-owner approval.

No infrastructure or analysis task may enable live execution implicitly.

---

## 21. Security Principles

The platform must remain private.

Security requirements include:

- Tailscale as the normal private access path
- no unnecessary public exposure
- secrets stored outside Git
- no credentials in source code
- authenticated MT5 bridge ingestion
- protected PostgreSQL access
- backups excluded from Git
- secrets excluded from logs
- production access limited to approved devices and users

---

## 22. Data Integrity Principles

Production data must be preserved.

The following are prohibited without explicit authorization:

- deleting production data
- resetting the production database
- mixing MT5 and non-MT5 evidence
- changing symbol mappings without validation
- altering schema casually
- overwriting backups
- restoring over production without an approved procedure

---

## 23. Deployment Principles

Production deployment must be controlled through Git.

```text
Linux Development
        ↓
Git Commit
        ↓
GitHub
        ↓
Windows VPS Deployment
```

Direct production editing should be avoided except during emergency recovery.

Every deployment must identify the branch, identify the commit, preserve secrets, preserve production data, support health verification, and support rollback.

---

## 24. Authority

This Constitution is the highest governing document for the Trading Analysis Platform.

All future specifications, architecture decisions, work orders, Codex instructions, testing documents, and engineering changes must conform to this document unless a newer Constitution version explicitly supersedes it.

Where a conflict exists, implementation must stop until the conflict is resolved.

---

## 25. Versioning

This document follows semantic versioning principles:

- patch update: clarification without architectural change
- minor update: new rule that preserves the existing direction
- major update: significant change to project architecture or governing principles

Every approved version must record the version number, date, summary of changes, and approval status.

---

## 26. Approval Status

This Constitution becomes active when accepted by the project owner.

Once active, it governs the entire Trading Analysis Platform repository and all future implementation work.

---

**End of Project Constitution v1.0**
