// Builds a student's admission number from school, class, and enrollment
// context. Every admission number is always exactly 13 characters — each
// piece below is padded or trimmed to a fixed width so the total never
// varies, no matter how big the school gets or how far the id counter
// climbs.
//
//   0  <schoolId>  <combination>  <level>  <insertionId>  <yearSuffix>
//   1  +   2     +      3       +   1    +      4        +    2        = 13
//
// e.g. school id 5, class "L3 NIT", academic year "2026-2027", and this
// being roughly the 1020th student ever enrolled ->
//   "0" + "05" + "NIT" + "3" + "1020" + "26" = "005NIT3102026" (13 chars).
//
//  - The leading "0" is always literal (1 char).
//  - schoolId is zero-padded to exactly 2 digits. Schools beyond #99 wrap
//    around (mod 100) rather than growing the field, which keeps every
//    admission number the same length — a 100th school is astronomically
//    unlikely for this system, so the trade-off is safe in practice.
//  - combination is the class's track/combination code, e.g. "NIT" or
//    "SOD" — the letters in the class name after the level digit(s).
//    Padded with "X" if shorter than 3 letters, trimmed to the first 3 if
//    longer.
//  - level is the class's level number, e.g. the "3" in "L3 NIT", reduced
//    to exactly 1 digit (the ones digit, for the rare multi-digit level).
//  - insertionId is the student's own database id — already a strictly
//    increasing, unique sequence — zero-padded to exactly 4 digits. Past
//    the 9999th student ever created system-wide it wraps (mod 10000)
//    to hold the fixed length; that ceiling is generous for a single
//    school's realistic lifetime enrollment.
//  - yearSuffix is the last two digits of the first 4-digit year found in
//    the academic year's name, e.g. "2026-2027" -> "26".

// Splits a class name like "L3 NIT", "L3NIT", or "l2 nit" into its level
// number and combination code. Falls back gracefully for class names that
// don't follow the "L<level> <combination>" convention (e.g. legacy names
// like "S1A") so admission numbers can still be generated for them.
function parseClassCode(className) {
  const clean = (className || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = clean.match(/^[A-Z]*(\d+)([A-Z]*)/);
  if (match && match[1]) {
    return { level: match[1], combination: match[2] || "GEN" };
  }
  return { level: "0", combination: clean || "GEN" };
}

// Pulls the last two digits of the first 4-digit year in the academic
// year's name — "2026-2027" -> "26". Falls back to "00" if no 4-digit year
// is found (e.g. a differently-formatted or missing academic year name).
function yearSuffix(academicYearName) {
  const match = (academicYearName || "").match(/\d{4}/);
  return match ? match[0].slice(-2) : "00";
}

// Zero-pads a non-negative integer to exactly `width` digits. If the
// number itself is already wider than `width`, it wraps around (mod
// 10^width) instead of growing the field, so the output length never
// changes.
function fixedDigits(value, width) {
  const n = Number(value) || 0;
  const max = 10 ** width;
  return String(((n % max) + max) % max).padStart(width, "0");
}

// Pads/trims an alphabetic code to exactly `width` letters — padded on the
// right with "X" if too short, trimmed to the first `width` letters if too
// long — so it never changes the overall admission number length.
function fixedLetters(value, width) {
  const clean = (value || "").toUpperCase().replace(/[^A-Z]/g, "");
  return (clean + "X".repeat(width)).slice(0, width);
}

function generateStudentId({ schoolId, className, academicYearName, insertionId }) {
  const { level, combination } = parseClassCode(className);
  return (
    "0" +
    fixedDigits(schoolId, 2) +
    fixedLetters(combination, 3) +
    fixedDigits(level, 1) +
    fixedDigits(insertionId, 4) +
    yearSuffix(academicYearName)
  );
}

module.exports = generateStudentId;
