class ProviderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProviderError";
    Object.assign(this, details);
  }
}

const createProviderError = ({
  code,
  status,
  statusCode,
  symbol,
  providerSymbol,
  timeframe,
  retryable = false,
  message,
}) =>
  new ProviderError(message, {
    code,
    status,
    statusCode,
    provider: "Twelve Data",
    symbol,
    providerSymbol,
    timeframe,
    retryable,
  });

const createRateLimitError = ({ symbol, providerSymbol, timeframe }) =>
  createProviderError({
    code: "RATE_LIMIT",
    status: "rate_limited",
    statusCode: 429,
    symbol,
    providerSymbol,
    timeframe,
    retryable: true,
    message: "Twelve Data rate limit reached. Retry later.",
  });

const createPlanLimitError = ({ symbol, providerSymbol, timeframe }) =>
  createProviderError({
    code: "PLAN_LIMIT",
    status: "plan_limited",
    statusCode: 402,
    symbol,
    providerSymbol,
    timeframe,
    retryable: false,
    message: `Twelve Data plan limit reached. ${providerSymbol} requires a higher plan.`,
  });

const createUnsupportedSymbolError = ({ symbol, providerSymbol, timeframe }) =>
  createProviderError({
    code: "UNSUPPORTED_SYMBOL",
    status: "unsupported_symbol",
    statusCode: 422,
    symbol,
    providerSymbol,
    timeframe,
    retryable: false,
    message: `Twelve Data does not support ${providerSymbol}.`,
  });

const createProviderResponseError = ({
  code = "BAD_PROVIDER_RESPONSE",
  symbol,
  providerSymbol,
  timeframe,
  message,
}) =>
  createProviderError({
    code,
    status: "provider_error",
    statusCode: 502,
    symbol,
    providerSymbol,
    timeframe,
    retryable: false,
    message,
  });

const isRateLimitError = (error) =>
  error?.code === "RATE_LIMIT" || error?.status === "rate_limited";

const serializeProviderError = (error) => ({
  status: error.status,
  provider: error.provider,
  symbol: error.symbol,
  providerSymbol: error.providerSymbol,
  ...(error.timeframe ? { timeframe: error.timeframe } : {}),
  retryable: error.retryable === true,
  message: error.message,
});

module.exports = {
  ProviderError,
  createProviderError,
  createRateLimitError,
  createPlanLimitError,
  createUnsupportedSymbolError,
  createProviderResponseError,
  isRateLimitError,
  serializeProviderError,
};
