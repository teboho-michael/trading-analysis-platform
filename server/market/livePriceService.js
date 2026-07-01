const { getMarketDataProvider } = require("./providers/providerFactory");
const { getInstrument, instrumentRegistry, normalizeProviderMode } = require("./instrumentRegistry");
const { getScanState } = require("../scheduler/scanState");

const cache = new Map();
let inFlight = null;
const getCacheTtl = () => Math.max(Number(process.env.LIVE_PRICE_CACHE_MS || 60000), 15000);

const normalizeQuote = (symbol, raw) => {
  const instrument = getInstrument(symbol);
  const bid = raw.bid === null || raw.bid === undefined ? NaN : Number(raw.bid);
  const ask = raw.ask === null || raw.ask === undefined ? NaN : Number(raw.ask);
  const rawPrice = Number(raw.price);
  const price = Number.isFinite(rawPrice) ? rawPrice : Number.isFinite(bid) ? bid : Number.isFinite(ask) ? ask : NaN;
  if (!Number.isFinite(price)) throw new Error(`LIVE_PRICE_ERROR: Provider returned no valid price for ${symbol}`);
  return { symbol, providerSymbol: instrument.providerSymbol, analysisProviderSymbol: instrument.activeAnalysisSymbol, tradingViewSymbol: instrument.tradingViewSymbol, dataSource: instrument.dataSourceLabel, priceScaleMode: instrument.priceScaleMode, sourceMode: instrument.sourceMode, dataModeLabel: instrument.dataModeLabel, syncStatus: instrument.syncStatus, price, bid: Number.isFinite(bid) ? bid : null, ask: Number.isFinite(ask) ? ask : null, timestamp: raw.timestamp || new Date().toISOString(), sourceTimestamp: raw.sourceTimestamp || raw.timestamp || null, marketStatus: raw.marketStatus || "unavailable", isProxy: instrument.isProxy, dataTruthNote: instrument.dataTruthNote };
};

const fetchQuotes = async (symbols) => {
  const mode = normalizeProviderMode();
  if (mode === "mock") throw new Error("MOCK_LIVE_PRICE_UNAVAILABLE: Mock mode does not provide real live prices");
  const provider = getMarketDataProvider();
  const settled = await Promise.allSettled(symbols.map(async (symbol) => normalizeQuote(symbol, await provider.getLatestPrice(symbol))));
  const quotes = [], errors = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") { cache.set(`${mode}:${symbols[index]}`, { quote: result.value, fetchedAt: Date.now() }); quotes.push(result.value); }
    else errors.push({ symbol: symbols[index], error: result.reason.message });
  });
  if (!quotes.length) { const error = new Error(errors.map((item) => `${item.symbol}: ${item.error}`).join("; ")); error.details = errors; throw error; }
  return { quotes, errors };
};

const getLivePrices = async (requestedSymbols) => {
  const symbols = requestedSymbols?.length ? requestedSymbols : Object.keys(instrumentRegistry);
  const unknown = symbols.filter((symbol) => !instrumentRegistry[symbol]);
  if (unknown.length) { const error = new Error(`UNKNOWN_INSTRUMENT: ${unknown.join(", ")}`); error.statusCode = 400; throw error; }
  const mode = normalizeProviderMode();
  const ttl = getCacheTtl();
  const now = Date.now();
  const cached = symbols.map((symbol) => cache.get(`${mode}:${symbol}`));
  const allFresh = cached.every((entry) => entry && now - entry.fetchedAt < ttl);
  if (allFresh) return { prices: cached.map((entry) => entry.quote), errors: [], cacheStatus: "fresh", cacheTtlMs: ttl };
  if (getScanState().running) {
    const available = cached.filter(Boolean).map((entry) => entry.quote);
    if (available.length) return { prices: available, errors: [], cacheStatus: "stale_during_scan", cacheTtlMs: ttl };
    const error = new Error("LIVE_PRICE_PAUSED_FOR_SCAN: Historical scan is using the provider quota"); error.statusCode = 503; throw error;
  }
  if (!inFlight) inFlight = fetchQuotes(symbols).finally(() => { inFlight = null; });
  const result = await inFlight;
  return { prices: result.quotes.filter((quote) => symbols.includes(quote.symbol)), errors: result.errors, cacheStatus: "refreshed", cacheTtlMs: ttl };
};

module.exports = { getLivePrices };
