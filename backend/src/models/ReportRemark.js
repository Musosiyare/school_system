const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class ReportRemark extends Model {}

ReportRemark.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    termId: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "ReportRemark",
    tableName: "report_remarks",
    indexes: [{ unique: true, fields: ["student_id", "term_id"] }],
  }
);

module.exports = ReportRemark;
