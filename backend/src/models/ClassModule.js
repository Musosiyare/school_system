const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class ClassModule extends Model {}

ClassModule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    moduleId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "ClassModule",
    tableName: "class_modules",
    indexes: [{ unique: true, fields: ["class_id", "module_id"] }],
  }
);

module.exports = ClassModule;
