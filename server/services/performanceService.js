const pool = require("../db/connection");

const COMPLETED = ["tp1_hit", "tp2_hit", "stopped_out", "invalidated", "manually_closed"];
const WINS = ["tp1_hit", "tp2_hit"];
const numeric = new Set(["average_final_r", "total_final_r", "win_rate", "win_rate_completed_setups"]);
const normalize = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, numeric.has(key) && value !== null ? Number(value) : value]));

const getPerformance = async (filters = {}) => {
  const values = [COMPLETED, WINS], clauses = [];
  if (filters.symbol) { values.push(String(filters.symbol).toUpperCase()); clauses.push(`symbol=$${values.length}`); }
  if (filters.from) { values.push(filters.from); clauses.push(`created_at >= $${values.length}`); }
  if (filters.to) { values.push(filters.to); clauses.push(`created_at <= $${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const completed = "entry_type='setup' AND outcome=ANY($1)";
  const aggregate = `COUNT(*) FILTER (WHERE entry_type='setup')::int total_setups,
    COUNT(*) FILTER (WHERE ${completed})::int completed_setups,
    CASE WHEN COUNT(*) FILTER (WHERE ${completed})=0 THEN NULL ELSE ROUND(100.0*COUNT(*) FILTER (WHERE entry_type='setup' AND outcome=ANY($2))/COUNT(*) FILTER (WHERE ${completed}),2) END win_rate,
    AVG(final_r_result) FILTER (WHERE ${completed} AND final_r_result IS NOT NULL) average_final_r,
    COALESCE(SUM(final_r_result) FILTER (WHERE ${completed} AND final_r_result IS NOT NULL),0) total_final_r,
    COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='tp1_hit')::int tp1_count,
    COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='tp2_hit')::int tp2_count,
    COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='stopped_out')::int stopped_out_count`;
  const [overall, bySymbol, byDirection, byEntryType] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int total_entries,COUNT(*) FILTER (WHERE entry_type='setup')::int total_setup_entries,
      COUNT(*) FILTER (WHERE entry_type='setup' AND lifecycle_status IN ('ready','watching','triggered'))::int open_setups,
      COUNT(*) FILTER (WHERE entry_type='setup' AND lifecycle_status='active')::int active_setups,
      COUNT(*) FILTER (WHERE ${completed})::int completed_setups,
      CASE WHEN COUNT(*) FILTER (WHERE ${completed})=0 THEN NULL ELSE ROUND(100.0*COUNT(*) FILTER (WHERE entry_type='setup' AND outcome=ANY($2))/COUNT(*) FILTER (WHERE ${completed}),2) END win_rate_completed_setups,
      AVG(final_r_result) FILTER (WHERE ${completed} AND final_r_result IS NOT NULL) average_final_r,
      COALESCE(SUM(final_r_result) FILTER (WHERE ${completed} AND final_r_result IS NOT NULL),0) total_final_r,
      COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='tp1_hit')::int tp1_count,
      COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='tp2_hit')::int tp2_count,
      COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='stopped_out')::int stopped_out_count,
      COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='invalidated')::int invalidated_count,
      COUNT(*) FILTER (WHERE entry_type='setup' AND outcome='manually_closed')::int manually_closed_count,
      COUNT(*) FILTER (WHERE requires_review=true)::int requires_review_count FROM setup_journal ${where}`, values),
    pool.query(`SELECT symbol,${aggregate} FROM setup_journal ${where} GROUP BY symbol ORDER BY symbol`, values),
    pool.query(`SELECT direction,${aggregate} FROM setup_journal ${where}${where ? " AND" : " WHERE"} entry_type='setup' GROUP BY direction ORDER BY direction`, values),
    pool.query(`SELECT entry_type,COUNT(*)::int entry_count,COUNT(*) FILTER (WHERE lifecycle_status IN ('ready','watching','triggered','active'))::int open_count,COUNT(*) FILTER (WHERE outcome=ANY($1))::int completed_count,COUNT(*) FILTER (WHERE outcome=ANY($2))::int winning_count FROM setup_journal ${where} GROUP BY entry_type ORDER BY entry_type`, values),
  ]);
  const qualityClauses = clauses.map((clause) => clause.replace(/^(symbol|created_at)/, "j.$1"));
  const quality = await pool.query(`WITH ranges(label,min_score,max_score,sort_order) AS (VALUES ('0-25',0,25,1),('26-50',26,50,2),('51-75',51,75,3),('76-100',76,100,4))
    SELECT r.label quality_range,COUNT(j.*)::int setup_count,COUNT(j.*) FILTER (WHERE j.outcome=ANY($1))::int completed_count,
      CASE WHEN COUNT(j.*) FILTER (WHERE j.outcome=ANY($1))=0 THEN NULL ELSE ROUND(100.0*COUNT(j.*) FILTER (WHERE j.outcome=ANY($2))/COUNT(j.*) FILTER (WHERE j.outcome=ANY($1)),2) END win_rate,
      AVG(j.final_r_result) FILTER (WHERE j.outcome=ANY($1) AND j.final_r_result IS NOT NULL) average_final_r
    FROM ranges r LEFT JOIN setup_journal j ON j.entry_type='setup' AND j.quality_score BETWEEN r.min_score AND r.max_score
      ${qualityClauses.length ? `AND ${qualityClauses.join(" AND ")}` : ""} GROUP BY r.label,r.sort_order ORDER BY r.sort_order`, values);
  return { overall: normalize(overall.rows[0]), bySymbol: bySymbol.rows.map(normalize), byDirection: byDirection.rows.map(normalize), byQualityRange: quality.rows.map(normalize), byEntryType: byEntryType.rows, generatedAt: new Date().toISOString() };
};

module.exports = { getPerformance };
