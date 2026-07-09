# V4.2 Pattern Discovery and Research Lab

## Purpose

V4.2 adds an explainable research layer over stored candles and saved backtests. It classifies market behavior, attaches deterministic pattern labels, and runs durable research experiments without changing live strategy rules or adding execution.

## Feature engineering

`featureEngineeringService` calculates EMA values, EMA distance, body/wicks/range, candle direction, average-range volatility, range position, consecutive EMA-side closes, basic trend strength, overextension, and direction-change chop. EMA 200 requires 200 stored candles; unavailable values are `insufficient_data`. EMA 100 exists only for parameter-research comparison.

## Market conditions and patterns

`marketConditionService` classifies bullish/bearish trend, sideways/choppy, directional overextension, directional pullback, breakout candidate, and mean-reversion risk. Rules use stored-candle features and return confidence only when thresholds support it. `patternDiscoveryService` maps that evidence to continuation, mean-reversion, overextension warning, choppy warning, pullback, or breakout-retest candidate labels. This is rule-based discovery, not ML.

## Trend versus mean reversion

Conditions are grouped into `trend_following`, `mean_reversion`, or `avoid_choppy`. The recommendation is explicitly research-only and never a trade instruction. Missing feature evidence returns `insufficient_data`.

## Research experiments

Migration `010_add_research_experiments.sql` adds `research_experiments` and `research_experiment_results`. Experiments preserve inputs, lifecycle status, summaries, errors, and metric rows.

- `condition_analysis`: condition frequency from classifiable candle rows.
- `feature_analysis`: average range, overextension count, and choppy count.
- `timeframe_readiness`: D1/H4/H1 stored-candle readiness.
- `strategy_comparison`: completed saved backtests when at least two strategy versions exist.
- `parameter_comparison`: EMA 100 versus EMA 200 feature readiness only; live rules remain unchanged.

Insufficient experiments are saved with `insufficient_data` and no invented metrics.

## Research Lab UI and APIs

The existing compact Research tab now includes Pattern Discovery and Research Lab sections. Users can choose an experiment, reuse the selected symbol/timeframe/date range, inspect recent experiments, and view saved summaries and metrics.

- `GET /api/research/conditions`
- `GET /api/research/experiments`
- `GET /api/research/experiments/:id`
- `GET /api/research/experiments/:id/results`
- `POST /api/research/experiments/run`

Normal validation errors return HTTP 400. Unknown records return HTTP 404. Research timeframes are D1, H4, and H1, preserving visual-only minute protection.

## Current limitations

Thresholds are basic and are not predictive claims. Candle-range volatility is a proxy, not ATR. Labels describe deterministic cohorts, not learned structures. Strategy-by-condition evidence needs completed setups and matching stored H1 history. Strategy comparison needs two completed versions. Parameter comparison does not optimize or mutate a strategy.

## Later work

Portfolio intelligence still needs cross-symbol exposure, correlation, costs, dataset snapshots, walk-forward evaluation, and out-of-sample controls. Broker execution remains a separate future boundary requiring reconciliation, permissions, risk controls, and audited order state. V4.2 contains no order placement or automated trading.
