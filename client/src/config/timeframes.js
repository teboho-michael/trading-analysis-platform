export const STRATEGY_TIMEFRAMES = ["H1", "H4", "D1"];
export const VISUAL_ONLY_TIMEFRAMES = ["M1", "M5", "M15"];
export const CHART_TIMEFRAMES = [...VISUAL_ONLY_TIMEFRAMES, ...STRATEGY_TIMEFRAMES];

export const isStrategyTimeframe = (timeframe) => STRATEGY_TIMEFRAMES.includes(timeframe);
export const isVisualOnlyTimeframe = (timeframe) => VISUAL_ONLY_TIMEFRAMES.includes(timeframe);
export const getAnalysisTimeframe = (timeframe) => isStrategyTimeframe(timeframe) ? timeframe : "H1";
