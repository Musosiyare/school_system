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

/**
 * The discipline office's termly call on this student, if one's been made
 * — sourced live from SBMS's shared sbms_deliberations table, same
 * raw-query-not-a-Model approach as getTermConductScore above and for the
 * exact same reason (see the file-level note): a Model here would get
 * pulled into SRS's sequelize.sync() and, under DB_SYNC_ALTER=true, could
 * alter/destroy columns this side doesn't own.
 *
 * One row per student+term in SBMS (unique on student_id+term_id), so this
 * is at most one decision: "dismissed_permanently" (expelled outright),
 * "dismissed_term" (out for the rest of this term only), or "retained"
 * (reviewed and kept enrolled despite exceeding marks). No row at all
 * means the discipline office hasn't ruled on this student this term —
 * distinct from "retained", which means they looked and chose to keep the
 * student.
 */
async function getTermDismissalDecision(studentId, termId) {
  const [row] = await sequelize.query(
    `SELECT decision, reason, decided_at AS decidedAt
     FROM sbms_deliberations
     WHERE student_id = :studentId AND term_id = :termId
     LIMIT 1`,
    { replacements: { studentId, termId }, type: QueryTypes.SELECT }
  );
  if (!row) return null;
  return {
    decision: row.decision,
    reason: row.reason || null,
    decidedAt: row.decidedAt,
  };
}

/**
 * Bulk check across ALL terms for which of the given students have ever
 * received a "dismissed_permanently" decision from SBMS's discipline
 * office. Unlike getTermDismissalDecision (scoped to one term, used for a
 * single report card), a permanent dismissal isn't term-scoped by
 * definition — once expelled, that stays true no matter which term is
 * being looked at — so this is what powers the "dismissed permanently"
 * flag/badge on student list views. Same raw-query-not-a-Model approach
 * as the rest of this file (see file-level note above).
 */
async function getPermanentlyDismissedStudentIds(studentIds) {
  const ids = [...new Set(studentIds || [])];
  if (ids.length === 0) return new Set();

  const rows = await sequelize.query(
    `SELECT DISTINCT student_id AS "studentId"
     FROM sbms_deliberations
     WHERE decision = 'dismissed_permanently' AND student_id IN (:ids)`,
    { replacements: { ids }, type: QueryTypes.SELECT }
  );
  return new Set(rows.map((r) => r.studentId));
}

/**
 * Whether this student has ANY misconduct record in SBMS at all — pending,
 * finalized, or rejected, in any term. Used to block deleting a student
 * from this side: SBMS's sbms_misconduct_records.student_id has no FK back
 * to this system's students table (separate app, separate repo), so a
 * delete here would silently orphan SBMS's incident history instead of
 * failing loudly — the record would sit there pointing at a student_id
 * that no longer exists, and anything in SBMS that looks the student back
 * up (report PDFs, the class-browser, discussion threads) would break.
 * Same raw-query-not-a-Model approach as the rest of this file (see
 * file-level note above).
 */
async function hasMisconductRecords(studentId) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*) AS count FROM sbms_misconduct_records WHERE student_id = :studentId`,
    { replacements: { studentId }, type: QueryTypes.SELECT }
  );
  return Number(row?.count || 0) > 0;
}

module.exports = {
  MARKS_PER_TERM,
  getTermConductScore,
  getTermDismissalDecision,
  getPermanentlyDismissedStudentIds,
  hasMisconductRecords,
};
