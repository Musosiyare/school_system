const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class StudentEnrollment extends Model {}

// One row per student per academic year: which class they were in that
// year. This is what makes years independent of each other — Student.classId
// only ever reflects a student's CURRENT class, so without this table,
// moving a student to a new class (a routine yearly step) would silently
// erase which class they were in for every year before that, breaking old
// terms' reports and rosters. Marks/Terms/Classes already carry their own
// academicYearId and never change after the fact — this table gives
// Student the same guarantee.
StudentEnrollment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "StudentEnrollment",
    tableName: "student_enrollments",
    indexes: [{ unique: true, fields: ["student_id", "academic_year_id"] }],
  }
);

module.exports = StudentEnrollment;
