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

    const updateZoneOverlay = () => {
      if (!activeZone || !zoneOverlayRef.current) return;

      const zoneHigh = Number(activeZone.zone_high);
      const zoneLow = Number(activeZone.zone_low);

      const highY = candleSeries.priceToCoordinate(zoneHigh);
      const lowY = candleSeries.priceToCoordinate(zoneLow);

      if (highY === null || lowY === null) return;

      const top = Math.min(highY, lowY);
      const height = Math.abs(lowY - highY);

      zoneOverlayRef.current.style.top = `${top}px`;
      zoneOverlayRef.current.style.height = `${height}px`;
      zoneOverlayRef.current.style.display = "block";
      zoneOverlayRef.current.style.background =
        activeZone.zone_type === "demand"
          ? "rgba(34, 197, 94, 0.16)"
          : "rgba(239, 68, 68, 0.16)";
      zoneOverlayRef.current.style.borderTop =
        activeZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
      zoneOverlayRef.current.style.borderBottom =
        activeZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
    };

    if (activeZone) {
      const zoneColor =
        activeZone.zone_type === "demand" ? "#22c55e" : "#ef4444";

      candleSeries.createPriceLine({
        price: Number(activeZone.zone_high),
        color: zoneColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${activeZone.zone_type.toUpperCase()} HIGH`,
      });

      candleSeries.createPriceLine({
        price: Number(activeZone.zone_low),
        color: zoneColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${activeZone.zone_type.toUpperCase()} LOW`,
      });
    }

    if (risk) {
      candleSeries.createPriceLine({
        price: Number(risk.entryPrice),
        color: "#3b82f6",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "ENTRY",
      });

      candleSeries.createPriceLine({
        price: Number(risk.stopLoss),
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "STOP LOSS",
      });

      candleSeries.createPriceLine({
        price: Number(risk.takeProfit1),
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "TP1",
      });

      candleSeries.createPriceLine({
        price: Number(risk.takeProfit2),
        color: "#16a34a",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "TP2",
      });
    }

    if (latestSignal) {
      candleSeries.createPriceLine({
        price: Number(latestSignal.entry_price),
        color: latestSignal.signal_type === "BUY" ? "#22c55e" : "#ef4444",
        lineWidth: 3,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `${latestSignal.signal_type} SIGNAL`,
      });
    }

    chart.timeScale().fitContent();

    setTimeout(updateZoneOverlay, 100);

    chart.timeScale().subscribeVisibleTimeRangeChange(updateZoneOverlay);

    return () => {
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