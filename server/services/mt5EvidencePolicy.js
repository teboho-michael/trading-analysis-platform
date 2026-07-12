const pool = require("../db/connection");

const MT5_SOURCE = "mt5_broker";
const ACTIVE_DATA_SOURCE = "mt5_broker";
const SOURCE_PURITY_MT5_ONLY = "mt5_only";
const SOURCE_PURITY_MIXED = "mixed_sources_present";

const emptySourceMetadata = () => ({
  data_source: ACTIVE_DATA_SOURCE,
  source_purity: SOURCE_PURITY_MT5_ONLY,
  mt5_candle_count: 0,
  non_mt5_candle_count: 0,
  earliest_mt5_candle: null,
  latest_mt5_candle: null,
});

const sourceMetadataForScope = async ({ symbol = null, timeframe = null, dateTo = null } = {}, queryable = pool) => {
  const result = await queryable.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE c.source = $1)::int AS mt5_candle_count,
        COUNT(*) FILTER (WHERE c.source IS DISTINCT FROM $1)::int AS non_mt5_candle_count,
        MIN(c.candle_time) FILTER (WHERE c.source = $1) AS earliest_mt5_candle,
        MAX(c.candle_time) FILTER (WHERE c.source = $1) AS latest_mt5_candle
      FROM candles c
      JOIN assets a ON a.id = c.asset_id
      WHERE ($2::text IS NULL OR a.symbol = $2)
        AND ($3::text IS NULL OR c.timeframe = $3)
        AND ($4::timestamp IS NULL OR c.candle_time <= $4)
    `,
    [MT5_SOURCE, symbol, timeframe, dateTo],
  );
  const row = result.rows[0] || {};
  const mt5Count = Number(row.mt5_candle_count || 0);
  const nonMt5Count = Number(row.non_mt5_candle_count || 0);
  return {
    data_source: ACTIVE_DATA_SOURCE,
    source_purity: nonMt5Count > 0 ? SOURCE_PURITY_MIXED : SOURCE_PURITY_MT5_ONLY,
    mt5_candle_count: mt5Count,
    non_mt5_candle_count: nonMt5Count,
    earliest_mt5_candle: row.earliest_mt5_candle || null,
    latest_mt5_candle: row.latest_mt5_candle || null,
  };
};

const candleCountsBySource = async (queryable = pool) => {
  const result = await queryable.query(
    `
      SELECT
        COALESCE(c.source, 'unknown') AS source,
        a.symbol,
        c.timeframe,
        COUNT(*)::int AS candles,
        MIN(c.candle_time) AS earliest,
        MAX(c.candle_time) AS latest
      FROM candles c
      JOIN assets a ON a.id = c.asset_id
      GROUP BY COALESCE(c.source, 'unknown'), a.symbol, c.timeframe
      ORDER BY source, a.symbol, c.timeframe
    `,
  );
  return result.rows;
};

const evidencePolicy = () => ({
  data_source: ACTIVE_DATA_SOURCE,
  required_source: MT5_SOURCE,
  research_evidence_policy: "mt5_only",
  fallback_enabled: false,
});

module.exports = {
  MT5_SOURCE,
  ACTIVE_DATA_SOURCE,
  SOURCE_PURITY_MT5_ONLY,
  SOURCE_PURITY_MIXED,
  emptySourceMetadata,
  sourceMetadataForScope,
  candleCountsBySource,
  evidencePolicy,
};
