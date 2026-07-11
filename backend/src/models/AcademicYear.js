const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class AcademicYear extends Model {}

AcademicYear.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }, // e.g. "2026-2027"
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    // Exactly one academic year per school should be flagged current at a
    // time (enforced in the controller, not a DB constraint, since Sequelize
    // doesn't easily support a partial-unique-index across schoolId here).
    // Everything outside the Academic Years management page (class creation,
    // marks entry, reports, teacher views, etc.) filters down to this one.
    isCurrent: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: "AcademicYear", tableName: "academic_years" }
);

module.exports = AcademicYear;
