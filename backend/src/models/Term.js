const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Term extends Model {}

Term.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    name: {
      type: DataTypes.ENUM("Term 1", "Term 2", "Term 3"),
      allowNull: false,
    },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Term",
    tableName: "terms",
    indexes: [{ unique: true, fields: ["academic_year_id", "name"] }],
  }
);

module.exports = Term;
