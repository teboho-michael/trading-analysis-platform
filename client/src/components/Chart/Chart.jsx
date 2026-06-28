import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts";

function calculateEMA(candles, period = 200) {
  if (!candles || candles.length < period) return [];

  const multiplier = 2 / (period + 1);
  const emaData = [];

  let ema =
    candles
      .slice(0, period)
      .reduce((sum, candle) => sum + Number(candle.close), 0) / period;

  for (let i = period; i < candles.length; i++) {
    const close = Number(candles[i].close);
    ema = close * multiplier + ema * (1 - multiplier);

    emaData.push({
      time: candles[i].chart_time,
      value: Number(ema.toFixed(2)),
    });
  }

  return emaData;
}

export default function Chart({ candles, activeZone, risk, latestSignal }) {
  const chartContainerRef = useRef(null);
  const zoneOverlayRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !candles || candles.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { color: "#111827" },
        textColor: "#D9D9D9",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const visibleCandles = candles.slice(-160);

    candleSeries.setData(
      visibleCandles.map((candle) => ({
        time: candle.chart_time,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      }))
    );

    const emaSeries = chart.addSeries(LineSeries, {
      color: "#facc15",
      lineWidth: 2,
    });

    emaSeries.setData(calculateEMA(candles, 200).slice(-160));

    const validActiveZone =
      activeZone?.status === "active" &&
      !activeZone.broken_at &&
      !activeZone.mitigated_at
        ? activeZone
        : null;

    const updateZoneOverlay = () => {
      if (!validActiveZone || !zoneOverlayRef.current) {
        if (zoneOverlayRef.current) {
          zoneOverlayRef.current.style.display = "none";
        }
        return;
      }

      const zoneHigh = Number(validActiveZone.zone_high);
      const zoneLow = Number(validActiveZone.zone_low);

      const highY = candleSeries.priceToCoordinate(zoneHigh);
      const lowY = candleSeries.priceToCoordinate(zoneLow);

      if (highY === null || lowY === null) return;

      const top = Math.min(highY, lowY);
      const height = Math.abs(lowY - highY);

      zoneOverlayRef.current.style.top = `${top}px`;
      zoneOverlayRef.current.style.height = `${height}px`;
      zoneOverlayRef.current.style.display = "block";
      zoneOverlayRef.current.style.background =
        validActiveZone.zone_type === "demand"
          ? "rgba(34, 197, 94, 0.16)"
          : "rgba(239, 68, 68, 0.16)";
      zoneOverlayRef.current.style.borderTop =
        validActiveZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
      zoneOverlayRef.current.style.borderBottom =
        validActiveZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
    };

    if (validActiveZone) {
      const zoneColor =
        validActiveZone.zone_type === "demand" ? "#22c55e" : "#ef4444";
      const zoneLabel =
        validActiveZone.zone_type === "demand"
          ? "DEMAND ZONE"
          : "SUPPLY ZONE";

      candleSeries.createPriceLine({
        price: Number(validActiveZone.zone_high),
        color: zoneColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${zoneLabel} HIGH`,
      });

      candleSeries.createPriceLine({
        price: Number(validActiveZone.zone_low),
        color: zoneColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${zoneLabel} LOW`,
      });
    }

    const signalLevels = latestSignal
      ? {
          direction: latestSignal.signal_type,
          entry: latestSignal.entry_price,
          stopLoss: latestSignal.stop_loss,
          takeProfit1: latestSignal.take_profit_1,
          takeProfit2: latestSignal.take_profit_2,
        }
      : risk
        ? {
            direction: null,
            entry: risk.entryPrice,
            stopLoss: risk.stopLoss,
            takeProfit1: risk.takeProfit1,
            takeProfit2: risk.takeProfit2,
          }
        : null;

    const addLevel = (price, color, title, lineWidth = 2) => {
      if (price === null || price === undefined || price === "") return;

      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice)) return;

      candleSeries.createPriceLine({
        price: numericPrice,
        color,
        lineWidth,
        lineStyle: 0,
        axisLabelVisible: true,
        title,
      });
    };

    if (signalLevels) {
      addLevel(
        signalLevels.entry,
        "#3b82f6",
        signalLevels.direction
          ? `${signalLevels.direction} ENTRY`
          : "SETUP ENTRY",
        3,
      );
      addLevel(signalLevels.stopLoss, "#ef4444", "STOP LOSS");
      addLevel(signalLevels.takeProfit1, "#22c55e", "TAKE PROFIT 1");
      addLevel(signalLevels.takeProfit2, "#16a34a", "TAKE PROFIT 2");
    }

    chart.timeScale().fitContent();

    const overlayTimer = window.setTimeout(updateZoneOverlay, 100);
    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width });
      window.requestAnimationFrame(updateZoneOverlay);
    });

    resizeObserver.observe(chartContainerRef.current);

    chart.timeScale().subscribeVisibleTimeRangeChange(updateZoneOverlay);

    return () => {
      window.clearTimeout(overlayTimer);
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateZoneOverlay);
      chart.remove();
    };
  }, [candles, activeZone, risk, latestSignal]);

  return (
    <div style={{ position: "relative", width: "100%", height: "420px" }}>
      <div ref={chartContainerRef} className="chart-box" />
      <div
        ref={zoneOverlayRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          right: 0,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </div>
  );
}
