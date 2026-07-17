const TIMEFRAME_HOURS = Object.freeze({ H1: 1, H4: 4, D1: 24 });

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const iso = (date) => date.toISOString();

const isFxWeekendClosureBucket = (date) => {
  const day = date.getUTCDay();
  if (day === 6) return true;
  if (day === 0) return true;
  if (day === 5 && date.getUTCHours() > 20) return true;
  return false;
};

const missingBucketsBetween = (previousTime, nextTime, timeframe) => {
  const hours = TIMEFRAME_HOURS[timeframe];
  const previous = toDate(previousTime);
  const next = toDate(nextTime);
  if (!hours || !previous || !next || next <= previous) return [];
  const buckets = [];
  for (let cursor = addHours(previous, hours); cursor < next; cursor = addHours(cursor, hours)) {
    buckets.push(new Date(cursor));
  }
  return buckets;
};

const classifyGap = ({ symbol, timeframe, previous_time, candle_time, mt5AvailableMissingTimes = null, mt5Checked = false }) => {
  const previous = toDate(previous_time);
  const next = toDate(candle_time);
  const hours = TIMEFRAME_HOURS[timeframe];
  if (!symbol || !hours || !previous || !next || next <= previous) {
    return { classification: "timestamp_integrity_error", missing_candle_times: [], reason: "Invalid candle boundary or timeframe." };
  }
  const elapsedHours = (next.getTime() - previous.getTime()) / (60 * 60 * 1000);
  if (!Number.isInteger(elapsedHours / hours)) {
    return { classification: "timestamp_integrity_error", missing_candle_times: [], reason: "Gap is not aligned to the timeframe boundary." };
  }
  const missing = missingBucketsBetween(previous, next, timeframe);
  const missingIso = missing.map(iso);
  if (missing.length === 0) {
    return { classification: "none", missing_candle_times: [], reason: "No missing candle buckets." };
  }
  if (missing.every(isFxWeekendClosureBucket)) {
    return { classification: "expected_market_closure", missing_candle_times: missingIso, reason: `All missing ${timeframe} buckets fall inside the normal Friday close to Sunday FX weekend closure.` };
  }
  const availableSet = new Set((mt5AvailableMissingTimes || []).map((value) => iso(toDate(value))).filter(Boolean));
  if (availableSet.size && missingIso.some((value) => availableSet.has(value))) {
    return { classification: "repairable_import_gap", missing_candle_times: missingIso, repairable_candle_times: missingIso.filter((value) => availableSet.has(value)), reason: "MT5 history contains at least one missing stored bucket." };
  }
  if (mt5Checked) {
    return { classification: "missing_mt5_history", missing_candle_times: missingIso, reason: "MT5 history was checked and did not provide the missing buckets." };
  }
  return { classification: "unresolved", missing_candle_times: missingIso, reason: "Requires live MT5 history check on the VPS." };
};

const classifyGapRows = (rows, options = {}) => rows.map((row) => ({
  ...row,
  ...classifyGap({ ...row, ...(options[row.symbol]?.[row.timeframe] || {}) }),
}));

module.exports = { TIMEFRAME_HOURS, missingBucketsBetween, classifyGap, classifyGapRows };
