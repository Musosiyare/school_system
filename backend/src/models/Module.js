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
    // A manager can take a module fully out of service (independent of any
    // one class or term) — e.g. it was retired from the curriculum. While
    // false, teachers can no longer record marks against it in any class,
    // and it's dropped from report cards entirely. Defaults to true so
    // every existing/new module stays usable unless explicitly turned off.
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "Module",
    tableName: "modules",
    indexes: [{ unique: true, fields: ["school_id", "module_code"] }],
  }
);

module.exports = Module;
