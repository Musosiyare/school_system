const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

// Must match SBMS's conductScoreService.js exactly (MARKS_PER_TERM = 40),
// so the number shown on the SRS report card always agrees with what SBMS
// itself shows for the same student/term. If that constant ever changes in
// SBMS, update it here too.
const MARKS_PER_TERM = 40;

/**
 * Deliberately a raw, parameterized SQL query against SBMS's table —
 * NOT a Sequelize Model. SRS's server.js calls sequelize.sync() on
 * startup, which syncs every Model registered on that connection; a
 * Model here (even a "read-only" one with only a few columns declared)
 * would get pulled into that sync and, under DB_SYNC_ALTER=true, would
 * alter sbms_misconduct_records down to match whatever subset of columns
 * this file declared — which is exactly what happened once already and
 * silently destroyed columns SRS doesn't own. A raw query against
 * `sbms_misconduct_records` is never part of anything Sequelize syncs,
 * so this can't recur. Do not reintroduce a Model for this table on the
 * SRS side.
 */
async function getTermConductScore(studentId, termId) {
  const [row] = await sequelize.query(
    `SELECT SUM(marks_deducted) AS total
     FROM sbms_misconduct_records
     WHERE student_id = :studentId AND term_id = :termId AND status = 'finalized'`,
    { replacements: { studentId, termId }, type: QueryTypes.SELECT }
  );
  const deducted = Number(row?.total || 0);
  const remaining = MARKS_PER_TERM - deducted;
  return {
    maxMarks: MARKS_PER_TERM,
    deducted,
    remaining,
    atRisk: remaining < MARKS_PER_TERM / 2,
  };
}

module.exports = { MARKS_PER_TERM, getTermConductScore };
