const registry = require("../services/strategyRegistryService");

const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, error: error.message });
const list = async (_req, res) => { try { res.json({ success: true, strategies: await registry.listStrategyVersions() }); } catch (error) { sendError(res, error); } };
const get = async (req, res) => { try { const strategy = await registry.getStrategyVersion(req.params.id); if (!strategy) return res.status(404).json({ success: false, error: "Strategy version not found" }); res.json({ success: true, strategy }); } catch (error) { sendError(res, error); } };

module.exports = { list, get };
