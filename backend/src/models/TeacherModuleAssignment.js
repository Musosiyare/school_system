const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

class TeacherModuleAssignment extends Model {}

TeacherModuleAssignment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    teacherId: { type: DataTypes.INTEGER, allowNull: false },
    moduleId: { type: DataTypes.INTEGER, allowNull: false },
    classId: { type: DataTypes.INTEGER, allowNull: false },
    academicYearId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "TeacherModuleAssignment",
    tableName: "teacher_module_assignments",
    indexes: [
      {
        name: "tma_unique_assignment",
        unique: true,
        fields: ["teacher_id", "module_id", "class_id", "academic_year_id"],
      },
    ],
  }
);

module.exports = TeacherModuleAssignment;
