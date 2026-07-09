const research = require("../services/researchIntelligenceService");
const lab = require("../services/researchLabService");

const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, error: error.message });
const intelligence = async (req, res) => { try { res.json({ success: true, intelligence: await research.getResearchIntelligence(req.query) }); } catch (error) { sendError(res, error); } };
const conditions = async (req, res) => { try { res.json({ success: true, research: await lab.getConditions(req.query) }); } catch (error) { sendError(res, error); } };
const experiments = async (_req, res) => { try { res.json({ success: true, experiments: await lab.listExperiments() }); } catch (error) { sendError(res, error); } };
const experiment = async (req, res) => { try { const item = await lab.getExperiment(req.params.id); if (!item) return res.status(404).json({ success: false, error: "Research experiment not found" }); res.json({ success: true, experiment: item }); } catch (error) { sendError(res, error); } };
const experimentResults = async (req, res) => { try { const item = await lab.getExperiment(req.params.id); if (!item) return res.status(404).json({ success: false, error: "Research experiment not found" }); res.json({ success: true, experiment: item, results: await lab.getExperimentResults(req.params.id) }); } catch (error) { sendError(res, error); } };
const runExperiment = async (req, res) => { try { res.status(201).json({ success: true, ...(await lab.runExperiment(req.body || {})) }); } catch (error) { sendError(res, error); } };

module.exports = { intelligence, conditions, experiments, experiment, experimentResults, runExperiment };
