# Trading Analysis Platform

## Architecture Overview

### Version 1.0

---

## Document Information

| Item                | Value                                           |
| ------------------- | ----------------------------------------------- |
| Document            | Architecture Overview                           |
| Project             | Trading Analysis Platform                       |
| Version             | 1.0                                             |
| Status              | Active                                          |
| Authority           | Supporting Architecture Document                |
| Repository Location | `docs/constitution/ARCHITECTURE_OVERVIEW.md`    |
| Applies To          | Current development and production architecture |
| Primary Reference   | `docs/constitution/PROJECT_CONSTITUTION.md`     |

---

## 1. Purpose

This document describes the current architecture of the Trading Analysis Platform.

It explains:

- where development occurs
- where production runs
- how market data enters the platform
- how data is stored
- how analysis is produced
- how the frontend accesses the backend
- how the user accesses the system remotely
- which components are currently operational
- which operational gaps must still be resolved

This document describes the system as it currently exists.

It does not define future research, learning, backtesting, or automated execution architecture.

---

## 2. Current System Objective

The Trading Analysis Platform is a private market-analysis system designed to:

- collect market data from MetaTrader 5
- store broker-derived market data in PostgreSQL
- analyse selected financial instruments
- calculate trend and bias information
- detect supply and demand zones
- produce structured `BUY`, `SELL`, or `WAIT` outputs
- display results through a web dashboard
- support paper-trading and analysis workflows
- operate continuously on a Windows VPS
- remain securely accessible from a phone or development machine

The platform does not currently perform automated live trade execution.

---

## 3. High-Level Architecture

```text
Linux Development Environment
        │
        │ Git push
        ▼
GitHub Repository
        │
        │ Deployment / pull
        ▼
Windows VPS Production Environment
        │
        ├── MetaTrader 5 connected to XM
        ├── Python MT5 Bridge
        ├── Node.js / Express Backend
        ├── PostgreSQL Database
        ├── React / Vite Frontend
        └── Tailscale Private Network
```

---

## 4. Environment Separation

### 4.1 Development Environment

The development environment runs on Linux.

It is used for:

- source-code development
- debugging
- local testing
- Git operations
- branch management
- implementation through VS Code and Codex
- preparation of deployment changes

The Linux development machine is not the permanent production host.

It may be offline without affecting the intended production system.

### 4.2 Production Environment

The production environment runs permanently on a Windows VPS.

The VPS hosts:

- MetaTrader 5
- the XM trading account connection
- the Python MT5 bridge
- the backend API
- the PostgreSQL database
- the frontend application
- production environment variables
- runtime logs
- deployment files
- remote-access services

The production system is intended to operate continuously without depending on the Linux development machine.

### 4.3 Repository Flow

The intended source-code flow is:

```text
Linux Development
        │
        ▼
Git Commit
        │
        ▼
GitHub Repository
        │
        ▼
Windows VPS Deployment
```

Development changes must be committed and pushed before they are deployed to production.

Direct untracked production editing should be avoided except during emergency recovery.

---

## 5. Repository Structure

The current project follows a structure similar to:

```text
trading-analysis-platform/
│
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── constitution/
│   │   ├── PROJECT_CONSTITUTION.md
│   │   └── ARCHITECTURE_OVERVIEW.md
│   │
│   ├── specifications/
│   ├── decisions/
│   ├── work-orders/
│   └── testing/
│
├── server/
├── client/
├── tools/
│   └── mt5_bridge/
│
├── scripts/
└── package files and configuration
```

The exact internal file structure may evolve, but the major architectural boundaries must remain clear.

---

## 6. Production Components

### 6.1 MetaTrader 5

MetaTrader 5 is installed on the Windows VPS.

It is connected to the XM broker environment.

MT5 provides:

- broker symbols
- live broker prices
- historical candles
- timeframe data
- broker-specific symbol availability
- trading-session context

MT5 is the exclusive source of production market data.

### 6.2 Python MT5 Bridge

The Python MT5 bridge connects MetaTrader 5 to the Node.js backend.

Its responsibilities include:

- initializing the MetaTrader5 Python package
- confirming the MT5 terminal connection
- resolving broker symbols
- retrieving candle data
- retrieving data by timeframe
- normalizing payloads
- authenticating with the backend
- sending market data to the backend API
- reporting synchronization failures

The current bridge location is:

```text
tools/mt5_bridge/mt5_candle_bridge.py
```

The bridge is a production integration component.

It must not generate synthetic candles or substitute non-MT5 data.

### 6.3 Node.js Backend

The backend uses Node.js and Express.

Its responsibilities include:

- receiving authenticated MT5 bridge payloads
- validating incoming candle data
- writing market data to PostgreSQL
- exposing API endpoints
- running analysis logic
- calculating EMA-based trend
- determining higher-timeframe bias
- detecting supply and demand zones
- generating structured signal outputs
- serving frontend data
- supporting paper-demo functionality
- exposing operational health information

The backend is the central application service.

### 6.4 PostgreSQL Database

PostgreSQL is the permanent production database.

It stores platform data including:

- market candles
- symbols
- timeframes
- trend-analysis results
- bias results
- supply and demand zones
- generated signals
- signal status
- paper-demo data
- related operational records

The production database is named:

```text
trading_analysis
```

The production database user is:

```text
trading_app
```

Production and development databases must remain separate.

### 6.5 React Frontend

The frontend uses React and Vite.

Its responsibilities include:

- displaying the market watchlist
- displaying candlestick charts
- presenting higher-timeframe bias
- presenting H1 trend
- presenting supply and demand zones
- presenting `BUY`, `SELL`, or `WAIT` outputs
- presenting risk details
- presenting paper-demo information
- refreshing data from the backend
- supporting desktop and phone access

The frontend does not calculate authoritative trading logic.

It displays results provided by the backend.

### 6.6 Tailscale

Tailscale provides private network access to the production system.

It allows the platform to be accessed securely from approved devices without exposing the application directly to the public internet.

Tailscale is used for:

- phone access
- development-machine access
- private VPS connectivity
- reduced public attack exposure

The production dashboard should remain private unless a future security specification explicitly changes this policy.

---

## 7. Market Data Flow

The current market-data flow is:

```text
XM Broker
    │
    ▼
MetaTrader 5
    │
    ▼
Python MT5 Bridge
    │
    ▼
Authenticated Backend Endpoint
    │
    ▼
Validation and Normalization
    │
    ▼
PostgreSQL
    │
    ▼
Analysis Engine
    │
    ▼
Backend API
    │
    ▼
React Dashboard
```

---

## 8. Supported Markets

The current primary instrument set includes:

- US500
- US100
- XAUUSD
- BTCUSD
- USDJPY

Broker-specific symbol names may differ from platform-standard names.

The platform must maintain explicit mapping between:

```text
Platform Symbol
        ↕
XM Broker Symbol
```

Symbol mappings must not be changed without validation.

---

## 9. Supported Timeframes

The current analysis architecture uses:

- D1
- H4
- H1

Their intended roles are:

| Timeframe | Current Role                                  |
| --------- | --------------------------------------------- |
| D1        | Higher-timeframe market bias                  |
| H4        | Higher-timeframe bias and supply/demand zones |
| H1        | Trend confirmation and setup generation       |

Future timeframes may be added only through an approved specification.

---

## 10. Current Analysis Flow

The current analysis process is:

```text
D1 Candle Data
      │
      ├── EMA200 calculation
      └── D1 bias

H4 Candle Data
      │
      ├── EMA200 calculation
      ├── H4 bias
      └── Supply and demand zones

H1 Candle Data
      │
      ├── EMA200 trend
      ├── Confirmation logic
      └── Setup evaluation

Combined Evidence
      │
      ▼
BUY / SELL / WAIT
      │
      ▼
Risk Structure
      │
      ▼
Dashboard and Paper Demo
```

---

## 11. EMA200 Logic

The current H1 trend rule is based on the 200-period exponential moving average.

The operating rule is:

- two consecutive closes above EMA200 indicate a bullish trend
- two consecutive closes below EMA200 indicate a bearish trend
- otherwise, the trend is neutral

The D1 and H4 timeframes also use EMA200 to contribute to higher-timeframe bias.

EMA200 is currently one component of the system and not a complete trading strategy by itself.

---

## 12. Supply and Demand Zones

Supply and demand zones are detected primarily from H4 market data.

Zone responsibilities include:

- identifying candidate supply areas
- identifying candidate demand areas
- storing zone boundaries
- tracking active zones
- supporting setup evaluation
- contributing to `BUY`, `SELL`, or `WAIT` decisions

Zone logic must remain backend-controlled and evidence-based.

The frontend may display zones but must not independently create them.

---

## 13. Signal Generation

The current signal engine combines:

- D1 bias
- H4 bias
- H1 trend
- zone proximity
- confirmation conditions
- risk parameters

The result is one of:

```text
BUY
SELL
WAIT
```

Signals may contain:

- entry
- stop loss
- take profit 1
- take profit 2
- risk-to-reward information
- active or monitoring status
- supporting analysis evidence

`WAIT` is a valid and important output.

The platform must not force a trade where the evidence is insufficient.

---

## 14. Paper Demo

The Paper Demo component allows trading logic and signals to be observed without submitting live orders to the broker.

Its role is to:

- record simulated decisions
- observe potential entries
- track risk structures
- evaluate system behaviour
- support testing before any future execution capability

Paper Demo is not live automated execution.

---

## 15. API Responsibilities

The backend API currently provides communication between:

- the Python bridge and backend
- the frontend and backend
- analysis services and stored data

API responsibilities include:

- bridge authentication
- data validation
- candle ingestion
- analysis retrieval
- signal retrieval
- dashboard aggregation
- health responses

Production API endpoints must not accept unauthenticated bridge writes.

---

## 16. Authentication and Secrets

Production secrets may include:

- MT5 bridge secret
- PostgreSQL credentials
- backend environment variables
- deployment credentials
- remote-access credentials

Secrets must remain outside committed source code.

They must be stored in production environment configuration.

The following must not be committed:

```text
.env
.env.production
database passwords
bridge secrets
broker credentials
private tokens
```

---

## 17. Current Access Model

The current intended user-access path is:

```text
Approved Phone or Computer
            │
            ▼
Tailscale Private Network
            │
            ▼
Windows VPS
            │
            ├── Frontend
            └── Backend API
```

The platform is private.

Public internet exposure is not required for normal operation.

---

## 18. Current Production Status

The following components are understood to be operational:

- Windows VPS
- PostgreSQL installation
- production database
- MetaTrader 5 installation
- XM connection
- Python MetaTrader5 package
- Python bridge initialization
- backend application
- frontend application
- live MT5-derived prices
- EMA200 analysis
- supply and demand analysis
- `BUY`, `SELL`, or `WAIT` output
- Paper Demo
- Tailscale phone access

Current production branch:

```text
final-core-operational-release
```

Current known production commit:

```text
5a44675
```

These references must be verified against Git before future deployment work.

---

## 19. Current Operational Gaps

The major remaining infrastructure objective is permanent autonomous runtime.

The system still requires formal implementation and validation of:

- automatic startup after VPS reboot
- automatic backend restart after failure
- automatic frontend restart after failure
- automatic bridge restart after failure
- MT5 connection recovery
- service dependency ordering
- health monitoring
- failure alerting
- centralized logs
- log retention
- database backup automation
- backup retention
- backup restore testing
- simple GitHub-to-VPS deployment
- deployment rollback
- production configuration validation
- runtime status verification

These gaps belong to the Permanent Infrastructure Specification.

---

## 20. Production Boundaries

### 20.1 MT5-Only Boundary

Only MT5 broker data may enter the production analysis and research evidence path.

### 20.2 Development Boundary

Development tools and fallback providers must remain separate from production data.

### 20.3 Frontend Boundary

The frontend presents analysis but does not become the authoritative analysis engine.

### 20.4 Bridge Boundary

The Python bridge transports and normalizes MT5 data.

It must not become a second independent trading-analysis engine.

### 20.5 Database Boundary

PostgreSQL is the authoritative persistent data store.

Runtime processes must not rely on temporary local files as the permanent source of truth.

### 20.6 Execution Boundary

The current architecture does not authorize automated live trade execution.

Any future execution capability requires a dedicated specification, risk controls, testing framework, and explicit project-owner approval.

---

## 21. Reliability Direction

The immediate architectural priority is to convert the existing working production deployment into a dependable autonomous runtime.

The production system must eventually:

- start automatically
- recover automatically
- report failures clearly
- preserve data
- maintain logs
- create backups
- support rollback
- remain accessible through Tailscale
- operate independently of the development laptop

This work must be completed before advanced research or trading-intelligence expansion.

---

## 22. Future Architecture Documents

The following documents will define future subsystem details:

```text
docs/specifications/PERMANENT_INFRASTRUCTURE_SPECIFICATION.md
docs/specifications/TRADING_INTELLIGENCE_SPECIFICATION.md
docs/specifications/RESEARCH_ENGINE_SPECIFICATION.md
docs/specifications/BACKTESTING_SPECIFICATION.md
docs/specifications/LEARNING_ENGINE_SPECIFICATION.md
docs/specifications/EXECUTION_ENGINE_SPECIFICATION.md
```

These documents must conform to:

```text
AGENTS.md
docs/constitution/PROJECT_CONSTITUTION.md
docs/constitution/ARCHITECTURE_OVERVIEW.md
```

---

## 23. Current Architectural Sequence

The approved order of work is:

1. document the current architecture
2. define the permanent infrastructure specification
3. implement autonomous Windows runtime
4. validate production reliability
5. define the trading intelligence specification
6. build research and backtesting capability
7. build future learning capability
8. consider execution only after sufficient validation

The project must not skip infrastructure reliability in order to reach advanced trading features faster.

---

## 24. Document Authority

This Architecture Overview is subordinate to the Project Constitution.

Its role is to describe the current system accurately.

Where this document conflicts with the Project Constitution, the Project Constitution takes precedence.

Where the implementation differs from this document, the difference must be investigated and the documentation or implementation corrected through an approved change.

---

## 25. Approval Status

This document becomes active when reviewed and accepted by the project owner.

Once accepted, it becomes the baseline architectural reference for the Permanent Infrastructure Specification.

---

**End of Architecture Overview v1.0**
