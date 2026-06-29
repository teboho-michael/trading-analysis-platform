const state = { running: false, lastSuccessfulScanAt: null, lastFailedScanAt: null, latestScanError: null, lastStatus: "never_run" };
const getScanState = () => ({ ...state });
const beginScan = () => { if (state.running) return false; state.running = true; state.lastStatus = "running"; return true; };
const completeScan = () => { state.running = false; state.lastSuccessfulScanAt = new Date().toISOString(); state.latestScanError = null; state.lastStatus = "completed"; };
const failScan = (error) => { state.running = false; state.lastFailedScanAt = new Date().toISOString(); state.latestScanError = error?.message || String(error); state.lastStatus = "failed"; };
module.exports = { getScanState, beginScan, completeScan, failScan };
