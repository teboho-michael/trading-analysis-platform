# INFRA-001 Audit and INFRA-002 Implementation Plan

## Confirmed Baseline

- VPS path: `C:\trading-analysis-platform`
- Production branch: `final-core-operational-release`
- Verified production commit: `5a446752a72e46612b49c92b88ddc8ca706e08b8`
- Runtime manager: Windows Task Scheduler
- Frontend production mode: `npm run build`, served by Node backend from `client\dist`
- MT5 bridge mode: `py -3.14 tools\mt5_bridge\mt5_candle_bridge.py --run-continuous`

## Current Runtime Findings

- Backend command is `npm start` from `server`, which runs `node app.js`.
- Backend listens on `PORT`, defaulting to `5000`.
- Backend health is `GET http://127.0.0.1:5000/api/system/health`.
- Backend serves API routes and static frontend assets from `client\dist`.
- Frontend development command is `npm run dev` from `client`.
- Frontend production build command is `npm run build` from `client`.
- Permanent production must not run `npm run preview`; the backend serves the built frontend.
- The MT5 bridge imports authenticated candle, tick, and heartbeat payloads into backend endpoints under `/api/broker/mt5`.
- Existing Windows scripts already cover start, stop, scheduled tasks, health checks, backups, restore, deployment, rollback, and private-access checks.

## Implementation Plan

1. Reuse Windows Task Scheduler instead of adding another process manager.
2. Register `TradingAnalysisPlatform-Backend` as the restartable backend task.
3. Register `TradingAnalysisPlatform-MT5ContinuousBridge` as the singleton bridge task.
4. Register `TradingAnalysisPlatform-HealthCheck` for periodic health checks.
5. Register `TradingAnalysisPlatform-DailyBackup` for daily PostgreSQL logical backups.
6. Remove permanent Vite preview dependency and serve `client\dist` through Node.
7. Validate non-secret configuration names before starting backend or bridge tasks.
8. Keep logs and backups under `C:\trading-analysis-platform`.
9. Protect restore testing by requiring an explicit database target and refusing production restores without an additional production-target switch.
10. Align deployment and rollback with exact commit deployment from `final-core-operational-release`.

## Boundaries

This infrastructure plan does not modify trading logic, EMA200 logic, supply and demand logic, signal logic, symbol mappings, database schema, broker credentials, Tailscale configuration, firewall rules, or live execution controls.
