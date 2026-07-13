const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class StudentEnrollment extends Model {}

// One row per student per academic year. This is the permanent history
// record — it is never edited or deleted once created, only ever added to.
// Student.classId stays as a fast "what class is this student in right now"
// pointer for the rest of the app (marks entry, rosters, etc.), but this
// table is the source of truth for "what class/year was this student in".
//
// Promotion (see promotionController.js) works by INSERTING a new row here
// for the new academic year — it never touches last year's row, so a
// student's full class history across every year stays intact and
// queryable, no matter how many times they've been promoted, repeated, or
// transferred.
StudentEnrollment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    // "new"        — first ever registration into the system
    // "promoted"   — moved up a level from the previous year
    // "repeated"   — stayed at the same level for another year
    // "transferred"— moved in from another class/school mid-flow
    // "graduated"  — completed their final level (no further enrollment expected)
    // "dropped"    — left the school
    status: {
      type: DataTypes.ENUM("new", "promoted", "repeated", "transferred", "graduated", "dropped"),
      allowNull: false,
      defaultValue: "new",
    },
    // Self-reference to the enrollment row this one was created from, so a
    // student's year-to-year chain can be walked forward or backward without
    // guessing from dates alone.
    promotedFromEnrollmentId: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: "StudentEnrollment",
    tableName: "student_enrollments",
    indexes: [
      // A student can only have ONE enrollment row per academic year — this
      // is what stops a promotion from accidentally running twice.
      { unique: true, fields: ["student_id", "academic_year_id"] },
    ],
  }
);

module.exports = StudentEnrollment;
