# Final Architecture Roadmap

## Vision and milestones

The platform is a private, evidence-led systematic trading research environment with honest source attribution, TradingView visual workspace, internal analysis, forward testing, performance review, and later reproducible backtesting. Research and execution remain separate.

- V3.2: TradingView terminal mode and internal fallback.
- V3.3: direct-symbol analysis; no silent index proxies.
- V3.3.1: provider rate/plan-limit handling.
- V3.4: forward-test journal foundation.
- V3.5: refined journal entry types and protected visual-only timeframes.
- V3.6: live setup lifecycle and journal-derived performance layer.
- V4.0: historical research layer with strategy versions, stored-candle backtest runs, evidence results, and compact Research UI.
- V4.1: required-data readiness, preflight protection, statistical summaries, and first-level research intelligence.
- V4.2: deterministic feature engineering, pattern discovery, market-condition and trend-versus-mean-reversion analysis, Research Lab experiments, and strategy/parameter comparison foundations.

## Modules and database roadmap

Market ingestion/provider health feed normalized candles and explicit source metadata. Trend, zones, setup quality, signals, and risk remain analysis modules. The journal is the durable proof layer. Its lifecycle and performance services consume only stored candles, backend prices, and journal outcomes. Future strategy-registry and backtest modules will consume reviewed data through separate boundaries.

Current durable entities are assets, candles, zones, signals, scan runs, alerts, `setup_journal`, `strategy_versions`, `backtest_runs`, `backtest_results`, `research_experiments`, and `research_experiment_results`. Future additive migrations may introduce dataset snapshots and portfolio experiments. Data must never be wiped automatically.

## Build phases

- V4: strategy versioning, stored-candle backtesting, data readiness, required-timeframe collection, historical research, statistical summaries, signal-scoring foundation, research intelligence, and evidence-based per-asset recommendations.
- V4.1: completes V4 operational readiness and first-level intelligence; broker-data reconciliation and dataset provenance remain later work.
- V4.2: adds deterministic pattern discovery, feature engineering, condition analysis, Research Lab experiments, strategy/parameter comparison foundations, and trend-versus-mean-reversion research.
- V5: explicit research costs, walk-forward evaluation, and deployment-readiness boundaries after evidence supports them.

## V3.4 scope

Implemented: migration 006, journal service/controller/API, idempotent signal import, validated manual creation, outcome/review tracking, basic real-data stats, compact lower tab, and a setup action requiring valid levels.

Deferred: backtesting, optimization, ML, automatic outcome tracking, broker orders, portfolio risk, live contract-spec sizing, expanded alerts, and fake placeholder results.

## V3.6 scope

Implemented: additive migration 008, broker-ready reconciliation fields, evidence-only candle/price lifecycle service, ambiguity review, structured lifecycle endpoints, real journal performance grouped by symbol/direction/quality/entry type, an operational Forward Test Journal workspace, and journal-backed Performance tab.

Deliberately deferred: background jobs, XM/MT5 connectivity, broker tickets, order placement, automatic execution, inferred outcomes without market evidence, and proxy index data.

## V4.0 scope

Implemented: additive migration 009, a real seeded strategy version, registry/query APIs, deterministic as-of-time D1/H4/H1 evaluation over stored candles, conservative TP/SL ambiguity handling, durable run/result records, aggregate R metrics, and a compact lower Research tab.

Deliberately deferred: provider collection during a run, TradingView data access, transaction costs, intrabar order guesses, portfolio simulation, optimization, broker orders, and fake results when stored history is insufficient.

## V4.2 scope

Implemented: deterministic stored-candle features, explainable market-condition and pattern labels, trend-versus-mean-reversion cohorts, condition-linked backtest intelligence, durable research experiments, EMA/timeframe/strategy comparison foundations, and compact Pattern Discovery and Research Lab UI sections.

Deliberately deferred: ML, automatic optimization, predictive claims, walk-forward validation, portfolio allocation, broker execution, TradingView scraping, and results without stored evidence.

## Testing and commit workflow

Apply migrations explicitly. Run server syntax/API checks, candle verification, client lint, and production build (temporary output directory if needed). Verify both chart modes and provider plan-limit behavior. Review diffs and proxy searches before a manual commit. V3.4 is not committed or merged automatically.
