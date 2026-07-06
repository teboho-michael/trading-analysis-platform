# V4.0 Backtesting and Strategy Versioning

## What V4 adds

V4 adds a historical research boundary built exclusively on stored PostgreSQL candles. The flow is: stored H1/H4/D1 candles → immutable strategy description → saved backtest run → as-of-time setup evaluation → saved outcomes and metrics. It does not read TradingView widget data, collect missing candles during a run, or place trades.

## Strategy versioning

`strategy_versions` records a stable strategy key, human name, version, timeframe contract, description, and JSON rule document. Migration 009 seeds `supply_demand_ema_200` version `v1`, representing the current D1/H4 EMA bias, H4 supply/demand zone, two-closed-H1-candle EMA confirmation, and existing zone-buffer/2R/3R risk logic.

## Backtest runs and results

`backtest_runs` is the durable run summary: requested range, status, candle/setup counts, aggregate R metrics, drawdown, summary JSON, and a clean failure reason when data is insufficient. `backtest_results` stores each historical setup, levels, trigger/close evidence, outcome, R result, review state, and JSON audit context.

## Historical evaluation and outcome rules

The V1 executable engine supports H1 setup evaluation. At each H1 close it reconstructs H1, H4, and D1 inputs using only candles whose timestamps are at or before that close. EMA context requires at least 201 real candles on each timeframe. H4 zones are detected from the then-available candles and rejected after a historical close breaks their boundary. Setups are deduplicated by zone.

Outcome checks use later H1 candle highs/lows only:

- BUY: TP when high reaches TP; SL when low reaches SL.
- SELL: TP when low reaches TP; SL when high reaches SL.
- If TP and SL are both touched in one candle, the result is `ambiguous`, `requires_review=true`, and no R value is guessed.
- Untriggered and still-open setups remain explicit and do not enter completed-performance metrics.

Win rate, average R, total R, and max drawdown R are calculated only from completed results with known R values. TP1 is +2R, TP2 is +3R, and stopped out is -1R because those levels come directly from the versioned current risk logic.

## API endpoints

- `GET /api/strategies`
- `GET /api/strategies/:id`
- `GET /api/backtests`
- `GET /api/backtests/:id`
- `POST /api/backtests/run`
- `GET /api/backtests/:id/results`

Validation and unsupported inputs return 400, an unknown strategy/run returns 404, and insufficient data creates a failed research record plus a clean 400 response.

## UI changes

The compact lower workspace now includes a Research tab. It provides strategy/symbol/timeframe/date controls, saved runs, a selected-run summary, and evidence rows. Empty, failed, and no-result states show text rather than placeholder numbers. Forward Test Journal, Performance, TradingView mode, and internal chart mode remain separate and unchanged.

## Current limitations

- The seeded strategy's executable implementation is H1-only and requires stored D1/H4/H1 history.
- There are no spreads, commissions, slippage, partial exits, position sizing, portfolio concurrency, or intrabar sequencing assumptions.
- Zone reconstruction reuses the current deterministic detector; it does not reproduce previously persisted zone rows.
- A run does not fetch missing provider or broker data.
- Database migrations must be applied explicitly before the endpoints are used.

## V4.1 / V5 candidates

Add dataset provenance/snapshots, explicit transaction-cost models, richer exit policies, parameterized strategy implementations, automated regression fixtures, walk-forward partitions, and broker-candle reconciliation. These remain research features; execution and order placement stay outside this layer.

V4.0 is the foundation. V4.1 completes operational research readiness, required-timeframe collection, preflight protection, statistical summaries, and first-level evidence intelligence.
