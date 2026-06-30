import {
  getInstrument,
  WATCHLIST_ORDER,
} from "../../config/instruments";

const formatPrice = (value) => {
  const price = Number(value);
  return Number.isFinite(price)
    ? price.toLocaleString(undefined, { maximumFractionDigits: 5 })
    : "—";
};

export default function Watchlist({
  dashboard,
  selectedAsset,
  selectedLatestPrice,
  onSelect,
  livePrices,
  movements,
}) {
  const assetsBySymbol = new Map(
    dashboard.map((asset) => [asset.symbol, asset]),
  );

  return (
    <aside className="watchlist panel-shell" aria-label="Market watchlist">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Markets</span>
          <h2>Watchlist</h2>
        </div>
        <span className="instrument-count">{WATCHLIST_ORDER.length}</span>
      </div>

      <div className="watchlist-rows">
        {WATCHLIST_ORDER.map((symbol) => {
          const asset = assetsBySymbol.get(symbol);
          const instrument = getInstrument(symbol);
          const displayBias =
            asset?.signal && asset.signal !== "WAIT"
              ? asset.signal
              : asset?.h1Trend;
          const latestPrice = livePrices?.[symbol]?.price ?? (selectedAsset === symbol && selectedLatestPrice !== undefined ? selectedLatestPrice : asset?.latestPrice);
          const movement = movements?.[symbol] || "flat";

          return (
            <button
              key={symbol}
              type="button"
              className={`watchlist-row${
                selectedAsset === symbol ? " selected" : ""
              }`}
              aria-pressed={selectedAsset === symbol}
              onClick={() => onSelect(symbol)}
            >
              <span className="watchlist-identity">
                <strong><i className={`live-dot${livePrices?.[symbol] ? " online" : ""}`} aria-hidden="true" />{symbol}</strong>
                <small>{instrument.name}</small>
                {asset?.instrument?.isProxy && (
                  <em>{asset.instrument.proxySymbol} proxy</em>
                )}
              </span>

              <span className="watchlist-market-data">
                <strong>{formatPrice(latestPrice)} <span className={`movement movement-${movement}`}>{movement === "up" ? "▲" : movement === "down" ? "▼" : "•"}</span></strong>
                <small
                  className={`market-bias ${String(displayBias)
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {displayBias || "Neutral"}
                </small>
                <small className={`stage-badge stage-${String(asset?.setupStage || "wait").toLowerCase()}`}>{asset?.setupStage || "WAIT"} · {asset?.qualityScore ?? 0}</small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
