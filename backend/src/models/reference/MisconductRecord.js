const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../config/database");

/**
 * READ-ONLY REFERENCE MODEL.
 *
 * SBMS-owned table (sbms_misconduct_records) — SRS connects to the same
 * MySQL database as SBMS (same DB_* env values, separate app/repo), so
 * this just points Sequelize at SBMS's table to read conduct data for the
 * report card. SRS never writes to this table; only SBMS creates/updates
 * these rows. See conductService.js for the score calculation, which
 * mirrors SBMS's own conductScoreService.js exactly (same 40-marks-per-term
 * rule) so the number on the report card always matches what SBMS shows.
 */
class MisconductRecord extends Model {}

MisconductRecord.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    termId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    marksDeducted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM("pending", "finalized", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  { sequelize, modelName: "MisconductRecord", tableName: "sbms_misconduct_records" }
);

module.exports = MisconductRecord;
