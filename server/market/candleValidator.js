const { getSymbolMeta } = require("./symbolMap");

const normalizeSymbol = (symbol) =>
  String(symbol || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const validateSourceSymbol = (requestedSymbol, sourceSymbol) => {
  const { providerSymbol, brokerSymbol } = getSymbolMeta(requestedSymbol);
  const expectedSymbols = new Set([
    normalizeSymbol(requestedSymbol),
    normalizeSymbol(providerSymbol),
    normalizeSymbol(brokerSymbol),
  ]);

  if (!sourceSymbol || !expectedSymbols.has(normalizeSymbol(sourceSymbol))) {
    throw new Error(
      `DATA_VALIDATION_ERROR: Provider symbol ${sourceSymbol || "missing"} does not match requested ${requestedSymbol} (${providerSymbol})`,
    );
  }
};

const validateCandle = (requestedSymbol, candle, index = null) => {
  const context = `${requestedSymbol}${index === null ? "" : ` candle ${index}`}`;
  const { priceRange } = getSymbolMeta(requestedSymbol);
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);
  const candleTime = new Date(candle.candle_time);

  if (![open, high, low, close].every(Number.isFinite)) {
    throw new Error(
      `DATA_VALIDATION_ERROR: ${context} contains non-numeric OHLC values`,
    );
  }

  if (high < open || high < close || low > open || low > close || high < low) {
    throw new Error(
      `DATA_VALIDATION_ERROR: ${context} has invalid OHLC ordering`,
    );
  }

  if (!candle.candle_time || Number.isNaN(candleTime.getTime())) {
    throw new Error(
      `DATA_VALIDATION_ERROR: ${context} has an invalid candle_time`,
    );
  }

  if (
    [open, high, low, close].some(
      (price) => price < priceRange.min || price > priceRange.max,
    )
  ) {
    throw new Error(
      `DATA_VALIDATION_ERROR: ${context} is outside the allowed ${priceRange.min}-${priceRange.max} range`,
    );
  }

  return {
    ...candle,
    open,
    high,
    low,
    close,
    volume: Number(candle.volume || 0),
    candle_time: candleTime,
  };
};

const validateProviderCandles = (requestedSymbol, candles) => {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error(
      `DATA_VALIDATION_ERROR: No candles returned for ${requestedSymbol}`,
    );
  }

  return candles.map((candle, index) => {
    validateSourceSymbol(requestedSymbol, candle.source_symbol);
    return validateCandle(requestedSymbol, candle, index);
  });
};

module.exports = {
  normalizeSymbol,
  validateCandle,
  validateProviderCandles,
  validateSourceSymbol,
};
