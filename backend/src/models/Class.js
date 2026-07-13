const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class Class extends Model {}

Class.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }, // e.g. "S1A"
    classTeacherId: { type: DataTypes.INTEGER, allowNull: true },
    // A suspended class is frozen for teachers — hidden from their class
    // pickers, and any direct attempt to read/write its data (marks,
    // rosters, reports) is blocked. The manager can still see and manage it
    // (and unsuspend it), and nothing about the class's data is touched —
    // this only ever changes what teachers can reach.
    isSuspended: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: "Class", tableName: "classes" }
);

module.exports = Class;
