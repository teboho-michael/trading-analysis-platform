const backtests = require("../services/backtestService");

const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, error: error.message, backtest_run_id: error.backtestRunId || undefined });
const list = async (_req, res) => { try { res.json({ success: true, backtests: await backtests.listBacktests() }); } catch (error) { sendError(res, error); } };
const get = async (req, res) => { try { const backtest = await backtests.getBacktest(req.params.id); if (!backtest) return res.status(404).json({ success: false, error: "Backtest run not found" }); res.json({ success: true, backtest }); } catch (error) { sendError(res, error); } };
const run = async (req, res) => { try { const backtest = await backtests.runBacktest(req.body || {}); res.status(201).json({ success: true, backtest }); } catch (error) { sendError(res, error); } };
const results = async (req, res) => { try { const backtest = await backtests.getBacktest(req.params.id); if (!backtest) return res.status(404).json({ success: false, error: "Backtest run not found" }); res.json({ success: true, backtest, results: await backtests.getBacktestResults(req.params.id) }); } catch (error) { sendError(res, error); } };

module.exports = { list, get, run, results };
