export const STRATEGY_TIMEFRAMES = ["H1", "H4", "D1"];
export const CHART_TIMEFRAMES = STRATEGY_TIMEFRAMES;

export const isStrategyTimeframe = (timeframe) => STRATEGY_TIMEFRAMES.includes(timeframe);
export const isVisualOnlyTimeframe = () => false;
export const getAnalysisTimeframe = (timeframe) => isStrategyTimeframe(timeframe) ? timeframe : "H1";
