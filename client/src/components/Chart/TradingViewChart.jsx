import { useEffect, useRef, useState } from "react";
import {
  getTradingViewInstrument,
  getTradingViewInterval,
} from "../../config/tradingViewSymbols";

const SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export default function TradingViewChart({ symbol, timeframe }) {
  const containerRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);
  const instrument = getTradingViewInstrument(symbol);
  const tradingViewSymbol = useFallback
    ? instrument.fallbackTradingViewSymbol
    : instrument.tradingViewSymbol;
  const interval = getTradingViewInterval(timeframe);

  useEffect(() => setUseFallback(false), [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.replaceChildren();

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: tradingViewSymbol,
      interval,
      timezone: "exchange",
      theme: "dark",
      backgroundColor: "#0b0f17",
      gridColor: "rgba(42, 52, 69, 0.32)",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      withdateranges: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => container.replaceChildren();
  }, [interval, tradingViewSymbol]);

  return (
    <div className="tradingview-terminal">
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        aria-label={`${instrument.displayName} TradingView chart at ${timeframe}`}
      />
      <div className="tradingview-source-bar">
        <span>{tradingViewSymbol}</span>
        <span>{instrument.note}</span>
        <button type="button" onClick={() => setUseFallback((value) => !value)}>
          {useFallback ? "Use primary source" : "Try alternate source"}
        </button>
      </div>
    </div>
  );
}
