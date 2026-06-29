const pool = require("../db/connection");
const { collectCandlesForAsset } = require("../market/candleCollector");
const { calculateTrendFromCandles } = require("../analysis/trendEngine");
const { calculateRiskLevels } = require("../analysis/riskEngine");
const { detectZones } = require("../analysis/zoneEngine");
const {
  evaluateSignalLifecycle,
} = require("../analysis/signalLifecycleEngine");
const { cleanupOldCandles } = require("../market/candleRetention");
const { createSignalForZone } = require("../services/signalService");
const { updateZoneLifecycle } = require("../services/zoneLifecycleService");
const { getActiveZone, saveDetectedZone } = require("../services/zoneService");
const { evaluateSetupQuality } = require("../analysis/setupQualityEngine");
const { createAlertEvent, recordSetupStage, recordMarketState } = require("../services/alertService");
const { beginScan, completeScan, failScan } = require("./scanState");

const getProviderRequestDelay = () => {
  return Number(process.env.PROVIDER_REQUEST_DELAY_MS || 10000);
};

const getProviderMaxRetries = () => {
  return Number(process.env.PROVIDER_MAX_RETRIES || 2);
};

const getProviderRetryDelay = () => {
  return Number(process.env.PROVIDER_RETRY_DELAY_MS || 60000);
};

const shouldApplyProviderDelay = () => {
  return (process.env.MARKET_PROVIDER || "mock").toLowerCase() !== "mock";
};

const wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const isRateLimitError = (error) => {
  return error.message && error.message.includes("RATE_LIMIT");
};

const collectCandlesWithRetry = async (symbol, timeframe) => {
  const maxRetries = getProviderMaxRetries();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await collectCandlesForAsset(symbol, timeframe);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (!isRateLimitError(error) || isLastAttempt) {
        throw error;
      }

      console.log(
        `Rate limit hit for ${symbol} ${timeframe}. Waiting before retry ${attempt + 1}/${maxRetries}...`,
      );

      await wait(getProviderRetryDelay());
    }
  }
};

const assets = ["US500", "US100", "XAUUSD", "BTCUSD", "USDJPY"];
const timeframes = ["H1", "H4", "D1"];

const ZONE_PROXIMITY_PERCENT = 0.003; // 0.3%

const fetchAsset = async (symbol) => {
  const result = await pool.query("SELECT * FROM assets WHERE symbol = $1", [
    symbol,
  ]);

  return result.rows[0];
};

const fetchCandles = async (assetId, timeframe) => {
  const result = await pool.query(
    `
        SELECT open, high, low, close, volume, candle_time
        FROM candles
        WHERE asset_id = $1
        AND timeframe = $2
        ORDER BY candle_time DESC
        LIMIT 300
        `,
    [assetId, timeframe],
  );

  return result.rows;
};

const saveDetectedZones = async (assetId, timeframe) => {
  const candles = await fetchCandles(assetId, timeframe);
  const zones = detectZones(candles);

  const savedZones = [];

  for (const zone of zones) {
    const saved = await saveDetectedZone(assetId, timeframe, zone);

    savedZones.push(saved.zone);
  }

  return savedZones;
};

const getTrend = async (assetId, timeframe) => {
  const candles = await fetchCandles(assetId, timeframe);
  return calculateTrendFromCandles(candles, 200);
};

const updateSignalLifecycle = async (assetId) => {
  const assetResult = await pool.query("SELECT symbol FROM assets WHERE id=$1", [assetId]);
  const symbol = assetResult.rows[0]?.symbol || "UNKNOWN";
  const h1Candles = await fetchCandles(assetId, "H1");

  if (!h1Candles || h1Candles.length === 0) {
    return {
      signalsChecked: 0,
      signalsUpdated: 0,
    };
  }

  const latestCandle = h1Candles[0];

  const signalsResult = await pool.query(
    `
    SELECT *
    FROM signals
    WHERE asset_id = $1
    AND status = 'active'
    `,
    [assetId],
  );

  const activeSignals = signalsResult.rows;

  let signalsUpdated = 0;

  for (const signal of activeSignals) {
    const lifecycle = evaluateSignalLifecycle(signal, latestCandle);

    if (lifecycle.status !== "active") {
      const updated = await pool.query(
        `
        UPDATE signals
        SET 
          status = $1,
          closed_at = CURRENT_TIMESTAMP,
          exit_price = $2,
          outcome_reason = $3
        WHERE id = $4
        AND status = 'active'
        `,
        [
          lifecycle.status,
          lifecycle.exitPrice,
          lifecycle.outcomeReason,
          signal.id,
        ],
      );

      signalsUpdated += updated.rowCount;
      if (updated.rowCount) {
        const eventTypes = { STOP_LOSS_HIT: "stop_loss_hit", TAKE_PROFIT_1_HIT: "tp1_hit", TAKE_PROFIT_2_HIT: "tp2_hit" };
        await createAlertEvent({ assetId, symbol, alertType: eventTypes[lifecycle.outcomeReason] || "signal_closed", severity: lifecycle.outcomeReason === "STOP_LOSS_HIT" ? "important" : "info", message: `${symbol} ${lifecycle.outcome}`, relatedSignalId: signal.id, relatedZoneId: signal.zone_id });
      }
    }
  }

  return {
    signalsChecked: activeSignals.length,
    signalsUpdated,
  };
};
const getZoneProximity = (price, zone) => {
  if (!price || !zone) {
    return {
      isNearZone: false,
      distanceFromZone: null,
      distancePercent: null,
      zoneBuffer: null,
    };
  }

  const zoneHigh = Number(zone.zone_high);
  const zoneLow = Number(zone.zone_low);
  const currentPrice = Number(price);

  const zoneBuffer = currentPrice * ZONE_PROXIMITY_PERCENT;

  const upperBoundary = zoneHigh + zoneBuffer;
  const lowerBoundary = zoneLow - zoneBuffer;

  const isNearZone =
    currentPrice >= lowerBoundary && currentPrice <= upperBoundary;

  let distanceFromZone = 0;

  if (currentPrice > zoneHigh) {
    distanceFromZone = currentPrice - zoneHigh;
  } else if (currentPrice < zoneLow) {
    distanceFromZone = zoneLow - currentPrice;
  }

  const distancePercent = (distanceFromZone / currentPrice) * 100;

  return {
    isNearZone,
    distanceFromZone: Number(distanceFromZone.toFixed(2)),
    distancePercent: Number(distancePercent.toFixed(2)),
    zoneBuffer: Number(zoneBuffer.toFixed(2)),
  };
};

const expireActiveSignalsForAsset = async (
  assetId,
  reason = "Setup no longer valid",
) => {
  const result = await pool.query(
    `
        UPDATE signals
        SET status = 'expired'
        WHERE asset_id = $1
        AND status = 'active'
        RETURNING *
        `,
    [assetId],
  );

  return {
    expiredCount: result.rows.length,
    reason,
  };
};

const saveSignalIfValid = async (assetId, zoneId, signal, risk) => {
  if (!risk || signal === "WAIT") {
    const expired = await expireActiveSignalsForAsset(
      assetId,
      "Signal changed to WAIT",
    );

    return {
      signal: null,
      created: false,
      expiredCount: expired.expiredCount,
    };
  }

  const signalType = signal === "BUY SETUP" ? "BUY" : "SELL";

  const oppositeSignalType = signalType === "BUY" ? "SELL" : "BUY";

  await pool.query(
    `
        UPDATE signals
        SET status = 'expired'
        WHERE asset_id = $1
        AND signal_type = $2
        AND status = 'active'
        `,
    [assetId, oppositeSignalType],
  );

  const saved = await createSignalForZone({
    assetId,
    zoneId,
    signalType,
    entryPrice: risk.entryPrice,
    stopLoss: risk.stopLoss,
    takeProfit1: risk.takeProfit1,
    takeProfit2: risk.takeProfit2,
    riskReward: 2,
    riskAmount: risk.riskAmount,
    accountRiskAmount: risk.accountRiskAmount,
    positionSizeUnits: risk.positionSizeUnits,
    positionSizeNote: risk.positionSizeNote,
  });

  return {
    signal: saved.signal,
    created: saved.created,
    expiredCount: 0,
  };
};

const analyzeAsset = async (symbol) => {
  const asset = await fetchAsset(symbol);

  if (!asset) {
    return {
      symbol,
      status: "failed",
      error: "Asset not found",
      signalCreated: false,
      signalsExpired: 0,
    };
  }

  const daily = await getTrend(asset.id, "D1");
  const h4 = await getTrend(asset.id, "H4");
  const h1 = await getTrend(asset.id, "H1");

  await saveDetectedZones(asset.id, "H4");

  const zoneLifecycle = await updateZoneLifecycle(asset.id);
  const signalLifecycle = await updateSignalLifecycle(asset.id);

  const activeZone = await getActiveZone(asset.id);
  const latestPrice = h1.lastClose;

  const zoneProximity = getZoneProximity(latestPrice, activeZone);

  let signal = "WAIT";
  let signalReason = "No valid setup";

  const bullishConfluence =
    daily.trend === "Bullish" &&
    h4.trend === "Bullish" &&
    h1.trend === "Bullish";

  const bearishConfluence =
    daily.trend === "Bearish" &&
    h4.trend === "Bearish" &&
    h1.trend === "Bearish";

  if (!activeZone) {
    signalReason = "No active H4 zone";
  } else if (!zoneProximity.isNearZone) {
    signalReason = `Price is too far from ${activeZone.zone_type} zone`;
  } else if (bullishConfluence && activeZone.zone_type === "demand") {
    signal = "BUY SETUP";
    signalReason = "Bullish confluence and price near demand zone";
  } else if (bearishConfluence && activeZone.zone_type === "supply") {
    signal = "SELL SETUP";
    signalReason = "Bearish confluence and price near supply zone";
  } else {
    signalReason = "Trend confluence does not match active zone type";
  }

  const risk = calculateRiskLevels(
    asset.symbol,
    signal,
    latestPrice,
    activeZone,
  );
  const savedSignalResult = await saveSignalIfValid(
    asset.id,
    activeZone?.id,
    signal,
    risk,
  );
  const setupQuality = evaluateSetupQuality({ daily, h4, h1, activeZone, zoneProximity, risk, duplicateSignal: !savedSignalResult?.created && Boolean(savedSignalResult?.signal) });
  await recordSetupStage({ assetId: asset.id, symbol, stage: setupQuality.setupStage, score: setupQuality.qualityScore, zoneId: activeZone?.id });
  await recordMarketState({ assetId: asset.id, symbol, h1Trend: h1.trend, isNearZone: zoneProximity.isNearZone, zoneId: activeZone?.id });
  if (savedSignalResult?.created) await createAlertEvent({ assetId: asset.id, symbol, alertType: "signal_created", severity: "important", message: `${symbol} ${savedSignalResult.signal.signal_type} signal created`, relatedSignalId: savedSignalResult.signal.id, relatedZoneId: activeZone?.id });

  return {
    symbol,
    status: "analyzed",
    latestPrice,
    dailyBias: daily.trend,
    h4Bias: h4.trend,
    h1Trend: h1.trend,
    activeZone,
    zoneLifecycle,
    signalLifecycle,
    zoneProximity,
    signal,
    signalReason,
    risk,
    savedSignal: savedSignalResult?.signal || null,
    signalCreated: savedSignalResult?.created || false,
    signalsExpired: savedSignalResult?.expiredCount || 0,
    ...setupQuality,
  };
};

const saveScanRun = async ({
  scanType,
  status,
  collectionResults,
  analysisResults,
  startedAt,
}) => {
  const totalCollections = collectionResults.length;

  const successfulCollections = collectionResults.filter(
    (result) => result.status === "success",
  ).length;

  const failedCollections = collectionResults.filter(
    (result) => result.status === "failed",
  ).length;

  const signalsCreated = analysisResults.filter(
    (result) => result.signalCreated === true,
  ).length;

  const saved = await pool.query(
    `
        INSERT INTO market_scan_runs
        (
            scan_type,
            status,
            total_collections,
            successful_collections,
            failed_collections,
            signals_created,
            started_at,
            completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *
        `,
    [
      scanType,
      status,
      totalCollections,
      successfulCollections,
      failedCollections,
      signalsCreated,
      startedAt,
    ],
  );

  return saved.rows[0];
};

const runMarketScanInternal = async (scanType = "manual") => {
  const startedAt = new Date();

  const collectionResults = [];
  const analysisResults = [];

  for (const symbol of assets) {
    for (const timeframe of timeframes) {
      try {
        await collectCandlesWithRetry(symbol, timeframe);

        collectionResults.push({
          symbol,
          timeframe,
          status: "success",
        });

        if (shouldApplyProviderDelay()) {
          await wait(getProviderRequestDelay());
        }
      } catch (error) {
        collectionResults.push({
          symbol,
          timeframe,
          status: "failed",
          error: error.message,
        });
      }
    }

    try {
      const analysis = await analyzeAsset(symbol);
      analysisResults.push(analysis);
    } catch (error) {
      analysisResults.push({
        symbol,
        status: "failed",
        error: error.message,
        signalCreated: false,
        signalsExpired: 0,
      });
    }
  }

  const hasFailures =
    collectionResults.some((result) => result.status === "failed") ||
    analysisResults.some((result) => result.status === "failed");

  const scanStatus = hasFailures ? "completed_with_errors" : "completed";

  const candleRetention = await cleanupOldCandles();

  const scanRun = await saveScanRun({
    scanType,
    status: scanStatus,
    collectionResults,
    analysisResults,
    startedAt,
  });

  return {
    scanRun,
    candleRetention,
    collectionResults,
    analysisResults,
  };
};

const runMarketScan = async (scanType = "manual") => {
  if (!beginScan()) { const error = new Error("SCAN_IN_PROGRESS: A market scan is already running"); error.statusCode = 409; throw error; }
  try { const result = await runMarketScanInternal(scanType); completeScan(); return result; }
  catch (error) { failScan(error); throw error; }
};

module.exports = {
  runMarketScan,
};
