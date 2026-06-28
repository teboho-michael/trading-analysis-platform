const pool = require("../db/connection");

const getAllAssets = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM assets ORDER BY id");

    res.json({
      success: true,
      assets: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllAssets,
};
