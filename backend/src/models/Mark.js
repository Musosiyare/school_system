const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Mark extends Model {}

Mark.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    moduleId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    termId: { type: DataTypes.INTEGER, allowNull: false },
    score: { type: DataTypes.FLOAT, allowNull: false },
    recordedBy: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "Mark",
    tableName: "marks",
    indexes: [{ unique: true, fields: ["student_id", "module_id", "term_id"] }],
  }
);

module.exports = Mark;
