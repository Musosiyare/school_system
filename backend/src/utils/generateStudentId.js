const { Student } = require("../models");

// Every enrolled student gets a random 6-digit ID (000000-999999) instead of
// a manually-typed admission number — stored in the same `admissionNumber`
// column so nothing else in the schema/report code needs to change. Retries
// on the rare collision to guarantee it's unique across the whole system.
async function generateStudentId() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const existing = await Student.findOne({ where: { admissionNumber: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique student ID, please try again");
}

module.exports = generateStudentId;
