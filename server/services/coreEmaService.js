const pool = require("../db/connection");
const { calculateEMA } = require("../analysis/emaEngine");
const { getInstrument } = require("../market/instrumentRegistry");
const { MT5_SOURCE } = require("./mt5EvidencePolicy");

const TIMEFRAMES = ["D1", "H4", "H1"];

const closedCandleCutoffSql = (timeframe) => {
  if (timeframe === "H1") return "CURRENT_TIMESTAMP - INTERVAL '1 hour'";
  if (timeframe === "H4") return "CURRENT_TIMESTAMP - INTERVAL '4 hours'";
  return "CURRENT_TIMESTAMP - INTERVAL '1 day'";
};

const trendState = (price, ema) => {
  if (!Number.isFinite(price) || !Number.isFinite(ema)) return "insufficient_data";
  if (price > ema) return "bullish";
  if (price < ema) return "bearish";
  return "neutral";
};

const fetchClosedCandles = async (symbol, timeframe, limit = 260) => {
  const result = await pool.query(
    `SELECT c.open, c.high, c.low, c.close, c.candle_time
     FROM candles c
     JOIN assets a ON a.id = c.asset_id
     WHERE a.symbol = $1
       AND c.timeframe = $2
       AND c.source = $3
       AND c.candle_time <= ${closedCandleCutoffSql(timeframe)}
     ORDER BY c.candle_time DESC
     LIMIT $4`,
    [symbol, timeframe, MT5_SOURCE, limit],
  );
  return result.rows.reverse();
};

const calculateEmaStateFromCandles = (symbol, timeframe, candles) => {
  candles = candles.filter((candle) => candle.status !== "forming_current" && candle.isForming !== true);
  const latest = candles.at(-1);
  if (!latest || candles.length < 200) {
    return {
      platform_symbol: symbol,
      timeframe,
      latest_closed_price: latest ? Number(latest.close) : null,
      ema_200: null,
      price_above_ema: null,
      price_below_ema: null,
      distance_from_ema: null,
      trend_state: "insufficient_data",
      calculated_at: new Date().toISOString(),
      candle_time: latest?.candle_time || null,
      source: MT5_SOURCE,
      available_candles: candles.length,
    };
  }
  const ema200 = calculateEMA(candles, 200);
  const latestClosedPrice = Number(latest.close);
  const distance = latestClosedPrice - ema200;
  return {
    platform_symbol: symbol,
    timeframe,
    latest_closed_price: latestClosedPrice,
    ema_200: ema200,
    price_above_ema: latestClosedPrice > ema200,
    price_below_ema: latestClosedPrice < ema200,
    distance_from_ema: Number(distance.toFixed(10)),
    trend_state: trendState(latestClosedPrice, ema200),
    calculated_at: new Date().toISOString(),
    candle_time: latest.candle_time,
    source: MT5_SOURCE,
    available_candles: candles.length,
  };
};

const getEmaState = async (symbol, timeframe) => {
  const candles = await fetchClosedCandles(symbol, timeframe);
  return calculateEmaStateFromCandles(symbol, timeframe, candles);
};

const getH1Confirmation = async (symbol) => {
  const candles = await fetchClosedCandles(symbol, "H1");
  if (candles.length < 201) return { trend_state: "insufficient_data", candles_checked: candles.length };
  const lastTwo = candles.slice(-2);
  const states = lastTwo.map((_, index) => {
    const sliceEnd = candles.length - (1 - index);
    const slice = candles.slice(0, sliceEnd);
    const ema200 = calculateEMA(slice, 200);
    return Number(slice.at(-1).close) > ema200 ? "bullish" : Number(slice.at(-1).close) < ema200 ? "bearish" : "neutral";
  });
  const trend = states.every((state) => state === "bullish") ? "bullish" : states.every((state) => state === "bearish") ? "bearish" : "neutral";
  return { trend_state: trend, candles_checked: candles.length, last_two_states: states };
};

const recalculateEmaStates = async (symbol) => {
  const instrument = getInstrument(symbol);
  const states = [];
  for (const timeframe of TIMEFRAMES) {
    const state = await getEmaState(symbol, timeframe);
    await pool.query(
      `INSERT INTO core_ema_states
       (platform_symbol,broker_symbol,timeframe,latest_closed_price,ema_200,price_above_ema,price_below_ema,distance_from_ema,trend_state,calculated_at,candle_time,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,$10,$11)
       ON CONFLICT (platform_symbol,timeframe)
       DO UPDATE SET latest_closed_price=EXCLUDED.latest_closed_price, ema_200=EXCLUDED.ema_200,
         price_above_ema=EXCLUDED.price_above_ema, price_below_ema=EXCLUDED.price_below_ema,
         distance_from_ema=EXCLUDED.distance_from_ema, trend_state=EXCLUDED.trend_state,
         calculated_at=CURRENT_TIMESTAMP, candle_time=EXCLUDED.candle_time, source=EXCLUDED.source
       RETURNING *`,
      [symbol, instrument.brokerSymbol, timeframe, state.latest_closed_price, state.ema_200, state.price_above_ema, state.price_below_ema, state.distance_from_ema, state.trend_state, state.candle_time, MT5_SOURCE],
    );
    states.push(state);
  }
  return states;
};

module.exports = {
  TIMEFRAMES,
  calculateEmaStateFromCandles,
  fetchClosedCandles,
  getEmaState,
  getH1Confirmation,
  recalculateEmaStates,
};
