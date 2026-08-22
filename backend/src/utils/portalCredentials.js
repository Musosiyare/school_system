/**
 * Derives a permanent, human-readable Portal ID from a student's own stable
 * database id: "STU" + that id, zero-padded to 5 digits (e.g. "STU00214").
 *
 * Deliberately NOT based on admission number, class, or academic year — all
 * three change over a student's time at the school (admission numbers are
 * reissued every year at re-registration; class and year obviously change
 * too). The database id is the one thing about a student row that never
 * changes, so a Portal ID derived from it never needs reissuing, and a
 * student's login keeps working across promotions and year rollovers with
 * no action needed from staff. Matches the format the student-portal app's
 * own utils/portalUsername.js already produces, so ids issued before this
 * moved here stay valid.
 */
function generatePortalUsername(studentId) {
  return `STU${String(studentId).padStart(5, "0")}`;
}

/**
 * A short, easy-to-read-aloud-or-type temporary password for a login slip —
 * not meant to be a long-term password (mustChangePassword forces a change
 * on first login). Avoids visually ambiguous characters (0/O, 1/I/l).
 */
function generatePortalTempPassword(length = 8) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

module.exports = { generatePortalUsername, generatePortalTempPassword };
