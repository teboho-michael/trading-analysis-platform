# V4.1 Final Research Readiness and Intelligence

## Why V4.1 was needed

V4.0 established versioned strategies and honest stored-candle backtests, but a run could discover missing H4 or D1 history only after it started. V4.1 completes the operational research layer without inventing candles, outcomes, or recommendations.

## Required data and readiness

`supply_demand_ema_200` v1 declares D1 `bias_context`, H4 `zone_context`, and H1 `execution_confirmation`, each requiring 201 stored candles. The readiness service counts real database rows through the requested end date and returns count, earliest/latest timestamps, roles, and missing timeframes.

`POST /api/backtests/collect-required` checks readiness, skips ready timeframes, and reuses the provider-backed collector for missing D1/H4/H1 data. Per-timeframe outcomes are `already_ready`, `collected`, `partially_collected`, `rate_limited`, `plan_limited`, or `failed`. Direct provider symbols are preserved; no proxy or fabricated data is used.

## Backtest preflight and statistics

`POST /api/backtests/run` now performs readiness preflight. Missing data creates a failed run whose `result_summary_json` contains `failure_type=missing_data`, the missing timeframes, and the complete readiness breakdown. Ready runs continue through the V4.0 stored-candle engine. A completed zero-setup run remains completed. Same-candle TP/SL remains review-required with no guessed result.

Completed-run summaries include setup/completed counts, win rate, average/total R, TP1, TP2, stopped-out and review counts, plus direction and quality-score-range breakdowns. Missing-data and provider-limited failures are not treated as poor strategy performance.

## Research intelligence and scoring foundation

The intelligence service interprets saved runs/results by strategy and symbol. It reports evidence status, completed/failed/missing-data/zero-setup runs, outcomes, expectancy, recommendations, and reasons. Fewer than 10 completed setups produces `insufficient_data`; stronger labels require explicit sample and performance thresholds. Best/weakest symbols appear only when enough evidence exists.

Historical evidence remains separate from the live technical quality score. Responses expose a nullable `historical_evidence_score` and future component slots for technical, historical, risk, market-condition, and final-confidence scores. V4.1 never boosts a signal without evidence.

## APIs and UI

- `GET /api/backtests/readiness`
- `POST /api/backtests/collect-required`
- `GET /api/research/intelligence`
- Existing strategy/backtest endpoints remain compatible.

The compact Research tab shows D1/H4/H1 readiness, provider limitation messages, guarded run controls, saved results, and evidence-based intelligence. TradingView, internal charts, visual-only M1/M5/M15, journal, and performance remain separate.

## Provider limitations and final V4 definition

BTCUSD, XAUUSD, and USDJPY attempt real Twelve Data collection. US500 and US100 may be plan- or rate-limited and retain structured provider responses. V4 is now defined by strategy versioning, stored-candle backtesting, data readiness, required-timeframe collection, statistical summaries, first-level research intelligence, and a safe signal-scoring foundation. Advanced ML and execution remain out of scope.

## V4.2 continuation

V4.2 builds on V4.1 evidence readiness by adding deterministic feature, market-condition, and pattern research plus durable Research Lab experiments. V4.1 readiness and evidence thresholds remain the gate; V4.2 does not invent conclusions when stored candles or completed backtests are insufficient.
