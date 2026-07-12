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
    // Drives the passing line: "specific" modules need 70% to pass, while
    // "general" and "complementary" modules only need 50%. See
    // moduleController's computePassingLine — passingLine itself is always
    // derived from this field (and moduleWeight), never entered by hand.
    moduleType: {
      type: DataTypes.ENUM("specific", "general", "complementary"),
      allowNull: false,
      defaultValue: "general",
    },
  },
  {
    sequelize,
    modelName: "Module",
    tableName: "modules",
    indexes: [{ unique: true, fields: ["school_id", "module_code"] }],
  }
);

module.exports = Module;
