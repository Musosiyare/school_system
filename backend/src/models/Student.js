const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Student extends Model {}

Student.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    sex: { type: DataTypes.ENUM("M", "F"), allowNull: true },
    guardianName: { type: DataTypes.STRING, allowNull: true },
    guardianPhone: { type: DataTypes.STRING, allowNull: true },
    admissionNumber: { type: DataTypes.STRING, allowNull: true },
    // Set only on a student row created by the "Pull Students" feature —
    // points at the original student they were copied from. The original
    // is never modified by a pull (that's the whole point: pulling COPIES
    // a student into a new class/year, it doesn't move them), so this is
    // what lets the UI detect "this student was already pulled into that
    // class" without relying on the original's own enrollment history.
    pulledFromStudentId: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
  },
  { sequelize, modelName: "Student", tableName: "students" }
);

module.exports = Student;
