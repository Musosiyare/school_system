const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class School extends Model {}

School.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    logoUrl: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM("active", "suspended"),
      defaultValue: "active",
    },
  },
  { sequelize, modelName: "School", tableName: "schools" }
);

module.exports = School;
