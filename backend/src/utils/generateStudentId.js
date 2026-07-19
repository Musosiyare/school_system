// Builds a student's admission number from school, class, and enrollment
// context, instead of a random 6-digit number. Format (no fixed padding
// beyond what's noted):
//
//   0  <schoolId>  <combination>  <level>  <insertionId>  <yearSuffix>
//
// e.g. school id 5, class "L3 NIT", academic year "2026-2027", and this
// being roughly the 1020th student ever enrolled -> "05" + "NIT" + "3" +
// "1020" + "26" = "05NIT3102026".
//
//  - The leading "0" is always literal.
//  - schoolId is written as-is (no zero-padding).
//  - combination is the class's track/combination code, e.g. "NIT" or
//    "SOD" — the letters in the class name after the level digit(s).
//  - level is the class's level number, e.g. the "3" in "L3 NIT".
//  - insertionId is the student's own database id, which is already a
//    strictly-increasing, unique sequence — using it here means the whole
//    code is guaranteed unique per student with no retry/collision logic
//    needed.
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

function generateStudentId({ schoolId, className, academicYearName, insertionId }) {
  const { level, combination } = parseClassCode(className);
  return `0${schoolId}${combination}${level}${insertionId}${yearSuffix(academicYearName)}`;
}

module.exports = generateStudentId;
