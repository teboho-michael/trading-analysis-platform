import { getInstrument } from "../../config/instruments";

const formatValue = (value, maximumFractionDigits = 5) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, { maximumFractionDigits })
    : "—";
};

function AnalysisRow({ label, value, valueClass = "" }) {
  return (
    <div className="analysis-row">
      <span>{label}</span>
      <strong className={valueClass}>{value ?? "—"}</strong>
    </div>
  );
}

export default function AnalysisPanel({ asset, latestPrice }) {
  if (!asset) {
    return (
      <aside className="analysis-panel panel-shell">
        <p>Selected instrument analysis is unavailable.</p>
      </aside>
    );
  }

  const instrument = getInstrument(asset.symbol);
  const activeZone =
    asset.activeZone?.status === "active" &&
    !asset.activeZone.broken_at &&
    !asset.activeZone.mitigated_at
      ? asset.activeZone
      : null;
  const tradeLevels = asset.latestSignal
    ? {
        entry: asset.latestSignal.entry_price,
        stopLoss: asset.latestSignal.stop_loss,
        takeProfit1: asset.latestSignal.take_profit_1,
        takeProfit2: asset.latestSignal.take_profit_2,
      }
    : asset.risk
      ? {
          entry: asset.risk.entryPrice,
          stopLoss: asset.risk.stopLoss,
          takeProfit1: asset.risk.takeProfit1,
          takeProfit2: asset.risk.takeProfit2,
        }
      : null;
  const signal = asset.latestSignal?.signal_type || asset.signal || "WAIT";

  return (
    <aside className="analysis-panel panel-shell" aria-label="Selected asset analysis">
      <div className="panel-heading analysis-heading">
        <div>
          <span className="eyebrow">Selected market</span>
          <h2>{asset.symbol}</h2>
          <small>{instrument.name}</small>
        </div>
        <strong className="analysis-price">{formatValue(latestPrice)}</strong>
      </div>

      {instrument.proxyNote && (
        <div className="proxy-notice">
          <strong>{instrument.proxySymbol} proxy</strong>
          <span>{instrument.proxyNote}</span>
        </div>
      )}

      <section className="analysis-section">
        <h3>Market bias</h3>
        <AnalysisRow label="D1 bias" value={asset.dailyBias} />
        <AnalysisRow label="H4 bias" value={asset.h4Bias} />
        <AnalysisRow label="H1 trend" value={asset.h1Trend} />
      </section>

      <section className="analysis-section">
        <h3>Active H4 zone</h3>
        {activeZone ? (
          <>
            <AnalysisRow
              label="Type"
              value={activeZone.zone_type}
              valueClass={activeZone.zone_type}
            />
            <AnalysisRow
              label="Range"
              value={`${formatValue(activeZone.zone_low)} – ${formatValue(
                activeZone.zone_high,
              )}`}
            />
            <AnalysisRow
              label="Distance"
              value={
                asset.zoneProximity?.distancePercent !== null &&
                asset.zoneProximity?.distancePercent !== undefined
                  ? `${asset.zoneProximity.distancePercent}%`
                  : "—"
              }
            />
          </>
        ) : (
          <p className="analysis-empty">No valid active H4 zone.</p>
        )}
      </section>

      <section className="analysis-section">
        <h3>Possible trade</h3>
        <AnalysisRow
          label="Signal"
          value={signal}
          valueClass={signal === "WAIT" ? "neutral" : "signal-active"}
        />
        <p className="signal-explanation">
          {asset.signalReason || "No active setup reason available."}
        </p>

        {tradeLevels ? (
          <div className="trade-levels">
            <AnalysisRow label="Possible entry" value={formatValue(tradeLevels.entry)} />
            <AnalysisRow label="Stop loss" value={formatValue(tradeLevels.stopLoss)} />
            <AnalysisRow label="Take profit 1" value={formatValue(tradeLevels.takeProfit1)} />
            <AnalysisRow label="Take profit 2" value={formatValue(tradeLevels.takeProfit2)} />
          </div>
        ) : (
          <p className="analysis-empty">No entry levels until a valid setup exists.</p>
        )}
      </section>

      {asset.risk && (
        <section className="analysis-section">
          <h3>Risk estimate</h3>
          <AnalysisRow label="Account risk" value={`${asset.risk.riskPercent}%`} />
          <AnalysisRow
            label="Risk amount"
            value={formatValue(asset.risk.accountRiskAmount, 2)}
          />
          <AnalysisRow
            label="Position units"
            value={formatValue(asset.risk.positionSizeUnits, 6)}
          />
          {asset.risk.positionSizeNote && (
            <p className="risk-note">{asset.risk.positionSizeNote}</p>
          )}
        </section>
      )}
    </aside>
  );
}
