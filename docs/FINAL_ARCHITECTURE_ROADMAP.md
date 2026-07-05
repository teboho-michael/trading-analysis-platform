# Final Architecture Roadmap

## Vision and milestones

The platform is a private, evidence-led systematic trading research environment with honest source attribution, TradingView visual workspace, internal analysis, forward testing, performance review, and later reproducible backtesting. Research and execution remain separate.

- V3.2: TradingView terminal mode and internal fallback.
- V3.3: direct-symbol analysis; no silent index proxies.
- V3.3.1: provider rate/plan-limit handling.
- V3.4: forward-test journal foundation.
- V3.5: refined journal entry types and protected visual-only timeframes.
- V3.6: live setup lifecycle and journal-derived performance layer.

## Modules and database roadmap

Market ingestion/provider health feed normalized candles and explicit source metadata. Trend, zones, setup quality, signals, and risk remain analysis modules. The journal is the durable proof layer. Its lifecycle and performance services consume only stored candles, backend prices, and journal outcomes. Future strategy-registry and backtest modules will consume reviewed data through separate boundaries.

Current durable entities are assets, candles, zones, signals, scan runs, alerts, and `setup_journal`. Future additive migrations may introduce immutable strategy versions, backtest runs/trades, dataset snapshots, and portfolio experiments. Data must never be wiped automatically.

## Build phases

- V4: broker-data reconciliation, controlled lifecycle scheduling, and richer review workflows.
- V5: strategy registry and reproducible dataset/version metadata.
- V6: deterministic backtesting with explicit costs and provenance.
- V7: walk-forward research and deployment-readiness boundaries after evidence supports them.

## V3.4 scope

Implemented: migration 006, journal service/controller/API, idempotent signal import, validated manual creation, outcome/review tracking, basic real-data stats, compact lower tab, and a setup action requiring valid levels.

Deferred: backtesting, optimization, ML, automatic outcome tracking, broker orders, portfolio risk, live contract-spec sizing, expanded alerts, and fake placeholder results.

## V3.6 scope

Implemented: additive migration 008, broker-ready reconciliation fields, evidence-only candle/price lifecycle service, ambiguity review, structured lifecycle endpoints, real journal performance grouped by symbol/direction/quality/entry type, an operational Forward Test Journal workspace, and journal-backed Performance tab.

Deliberately deferred: background jobs, XM/MT5 connectivity, broker tickets, order placement, automatic execution, inferred outcomes without market evidence, and proxy index data.

## Testing and commit workflow

Apply migrations explicitly. Run server syntax/API checks, candle verification, client lint, and production build (temporary output directory if needed). Verify both chart modes and provider plan-limit behavior. Review diffs and proxy searches before a manual commit. V3.4 is not committed or merged automatically.
