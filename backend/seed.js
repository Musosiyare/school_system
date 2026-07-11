require("dotenv").config();
const bcrypt = require("bcryptjs");
const sequelize = require("./src/config/database");
const { User } = require("./src/models");

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const email = process.env.SUPERUSER_EMAIL;
  const password = process.env.SUPERUSER_PASSWORD;

  if (!email || !password) {
    console.error("SUPERUSER_EMAIL and SUPERUSER_PASSWORD must be set in .env");
    process.exit(1);
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`Superuser already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    schoolId: null,
    name: "Platform Superuser",
    email,
    passwordHash,
    role: "superuser",
    mustChangePassword: false,
  });

  console.log(`Superuser created successfully.`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("Log in and change this password if this is anything beyond local dev.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
