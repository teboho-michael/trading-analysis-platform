# Production Environment Variables

Do not commit real production values. Store production `.env` and local bridge JSON files only on the Windows VPS.

## Backend

Required:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `MT5_BRIDGE_SECRET`
- `MARKET_PROVIDER`

Optional/runtime controls:

- `SCAN_SCHEDULER_ENABLED`
- `SCAN_CRON`
- `MT5_BRIDGE_URL`
- `MT5_BRIDGE_TIMEOUT_MS`
- `PROVIDER_REQUEST_DELAY_MS`
- `PROVIDER_MAX_RETRIES`
- `PROVIDER_RETRY_DELAY_MS`
- `ACCOUNT_BALANCE`
- `RISK_PERCENT`
- `H4_ZONE_LOOKBACK`
- `CANDLE_RETENTION_LIMIT`
- `MT5_TICK_FUTURE_TOLERANCE_SECONDS`
- `MT5_TICK_SKEW_TOLERANCE_SECONDS`

## MT5 Bridge

Required:

- `PLATFORM_API_BASE_URL`
- `MT5_BRIDGE_SECRET`

Optional/runtime controls:

- `MT5_BRIDGE_STATE_FILE`
- `MT5_BRIDGE_RETRIES`
- `MT5_BRIDGE_RETRY_BASE_SECONDS`
- `MT5_BRIDGE_CANDLE_LIMIT`
- `MT5_BRIDGE_DEBUG`
- `MT5_TICK_FUTURE_TOLERANCE_SECONDS`

The bridge may read these from environment variables or from the ignored file `tools\mt5_bridge\mt5_bridge.local.json`.

## Frontend

The production frontend is built with `npm run build` and served by the backend from `client\dist`. The current frontend uses same-origin `/api` routing and does not require a production `VITE_API_BASE_URL`.
