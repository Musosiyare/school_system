const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

// A module is normally taught (and examined) every term. When that's not
// true for a specific class in a specific term — e.g. only 13 of a class's
// 15 modules had a mid-term test that term — the assigned teacher (or the
// manager) can flip this row to disabled=true for that one class+module+
// term combination. Every other term, and every other class this module is
// taught in, is completely unaffected.
class ClassModuleTermStatus extends Model {}

ClassModuleTermStatus.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    moduleId: { type: DataTypes.INTEGER, allowNull: false },
    termId: { type: DataTypes.INTEGER, allowNull: false },
    disabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    disabledBy: { type: DataTypes.INTEGER, allowNull: true },
    disabledAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ClassModuleTermStatus",
    tableName: "class_module_term_status",
    indexes: [{ unique: true, fields: ["class_id", "module_id", "term_id"] }],
  }
);

module.exports = ClassModuleTermStatus;
