const research = require("../services/researchIntelligenceService");
const intelligence = async (req, res) => { try { res.json({ success: true, intelligence: await research.getResearchIntelligence(req.query) }); } catch (error) { res.status(error.statusCode || 500).json({ success: false, error: error.message }); } };
module.exports = { intelligence };
