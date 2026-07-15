import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts";

const calculateEmaSeries = (candles, period = 200) => {
  if (candles.length < period) return [];
  const multiplier = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, candle) => sum + Number(candle.close), 0) / period;
  const values = [{ time: candles[period - 1].chart_time, value: ema }];
  for (let index = period; index < candles.length; index += 1) {
    ema = (Number(candles[index].close) - ema) * multiplier + ema;
    values.push({ time: candles[index].chart_time, value: ema });
  }
  return values;
};

export default function Chart({ candles, activeZone, risk, latestSignal }) {
  const chartContainerRef = useRef(null);
  const zoneOverlayRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !candles || candles.length === 0) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: "#0b0f17" },
        textColor: "#8c98aa",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#171d29" },
        horzLines: { color: "#171d29" },
      },
      rightPriceScale: {
        borderColor: "#252d3b",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "#252d3b",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 7,
      },
      crosshair: {
        vertLine: { color: "#526177", labelBackgroundColor: "#293345" },
        horzLine: { color: "#526177", labelBackgroundColor: "#293345" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#2dd4a7",
      downColor: "#f05b69",
      borderUpColor: "#2dd4a7",
      borderDownColor: "#f05b69",
      wickUpColor: "#2dd4a7",
      wickDownColor: "#f05b69",
      priceLineColor: "#8491a5",
    });

    const visibleCandles = candles.slice(-180);
    const marketLow = Math.min(...visibleCandles.map((candle) => candle.low));
    const marketHigh = Math.max(...visibleCandles.map((candle) => candle.high));
    const marketRange = marketHigh - marketLow;
    const annotationPadding = Math.max(marketRange * 0.12, marketHigh * 0.001);
    const isNearMarket = (price) => {
      const numericPrice = Number(price);
      return (
        Number.isFinite(numericPrice) &&
        numericPrice >= marketLow - annotationPadding &&
        numericPrice <= marketHigh + annotationPadding
      );
    };

    candleSeries.setData(
      visibleCandles.map((candle) => ({
        time: candle.chart_time,
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      }))
    );

    const emaCandles = candles.filter((candle) => !candle.isForming);
    const emaSeries = chart.addSeries(LineSeries, {
      color: "#f4bd62",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "EMA 200 · CLOSED MT5",
    });
    emaSeries.setData(calculateEmaSeries(emaCandles).slice(-180));

    const validActiveZone =
      ["active", "approaching", "inside", "tested"].includes(activeZone?.status) &&
      !activeZone.broken_at &&
      !activeZone.mitigated_at
        ? activeZone
        : null;
    const visibleActiveZone =
      validActiveZone &&
      isNearMarket(validActiveZone.zone_high) &&
      isNearMarket(validActiveZone.zone_low)
        ? validActiveZone
        : null;

    const updateZoneOverlay = () => {
      if (!visibleActiveZone || !zoneOverlayRef.current) {
        if (zoneOverlayRef.current) {
          zoneOverlayRef.current.style.display = "none";
        }
        return;
      }

      const zoneHigh = Number(visibleActiveZone.zone_high);
      const zoneLow = Number(visibleActiveZone.zone_low);

      const highY = candleSeries.priceToCoordinate(zoneHigh);
      const lowY = candleSeries.priceToCoordinate(zoneLow);

      if (highY === null || lowY === null) return;

      const top = Math.min(highY, lowY);
      const height = Math.abs(lowY - highY);

      zoneOverlayRef.current.style.top = `${top}px`;
      zoneOverlayRef.current.style.height = `${height}px`;
      zoneOverlayRef.current.style.display = "block";
      zoneOverlayRef.current.style.background =
        visibleActiveZone.zone_type === "demand"
          ? "rgba(34, 197, 94, 0.16)"
          : "rgba(239, 68, 68, 0.16)";
      zoneOverlayRef.current.style.borderTop =
        visibleActiveZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
      zoneOverlayRef.current.style.borderBottom =
        visibleActiveZone.zone_type === "demand"
          ? "1px dashed #22c55e"
          : "1px dashed #ef4444";
    };

    if (visibleActiveZone) {
      const zoneColor =
        visibleActiveZone.zone_type === "demand" ? "#2dd4a7" : "#f05b69";
      const zoneLabel =
        visibleActiveZone.zone_type === "demand"
          ? "DEMAND ZONE"
          : "SUPPLY ZONE";

      candleSeries.createPriceLine({
        price: Number(visibleActiveZone.zone_high),
        color: zoneColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${zoneLabel} HIGH`,
      });

      candleSeries.createPriceLine({
        price: Number(visibleActiveZone.zone_low),
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
      if (!isNearMarket(numericPrice)) return;

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
      chart.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
      window.requestAnimationFrame(updateZoneOverlay);
    });

    resizeObserver.observe(container);

    chart.timeScale().subscribeVisibleTimeRangeChange(updateZoneOverlay);

    return () => {
      window.clearTimeout(overlayTimer);
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateZoneOverlay);
      chart.remove();
    };
  }, [candles, activeZone, risk, latestSignal]);

  return (
    <div className="chart-canvas">
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
