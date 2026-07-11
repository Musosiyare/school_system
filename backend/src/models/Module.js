const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Module extends Model {}

Module.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    moduleCode: { type: DataTypes.STRING, allowNull: false },
    moduleTitle: { type: DataTypes.STRING, allowNull: false },
    moduleWeight: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
    maxScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 100 },
    passingLine: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 50 },
  },
  {
    sequelize,
    modelName: "Module",
    tableName: "modules",
    indexes: [{ unique: true, fields: ["school_id", "module_code"] }],
  }
);

module.exports = Module;
