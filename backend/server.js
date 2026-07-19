require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const sequelize = require("./src/config/database");
require("./src/models"); // register associations

const authRoutes = require("./src/routes/authRoutes");
const schoolRoutes = require("./src/routes/schoolRoutes");
const academicYearRoutes = require("./src/routes/academicYearRoutes");
const classRoutes = require("./src/routes/classRoutes");
const moduleRoutes = require("./src/routes/moduleRoutes");
const teacherRoutes = require("./src/routes/teacherRoutes");
const studentRoutes = require("./src/routes/studentRoutes");
const assignmentRoutes = require("./src/routes/assignmentRoutes");
const markRoutes = require("./src/routes/markRoutes");
const termRoutes = require("./src/routes/termRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const statisticsRoutes = require("./src/routes/statisticsRoutes");
const settingsRoutes = require("./src/routes/settingsRoutes");
const activityLogRoutes = require("./src/routes/activityLogRoutes");
const { getSettingsRow } = require("./src/controllers/settingsController");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/academic-years", academicYearRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/marks", markRoutes);
app.use("/api/terms", termRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/activity-logs", activityLogRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});

app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connection established.");
    // sync({ alter: true }) adds new columns/indexes as models change,
    // without dropping existing data - useful right after you edit a model.
    // BUT: running it on every nodemon restart is what causes MySQL's
    // "Too many keys specified; max 64 keys allowed" error - Sequelize can
    // fail to recognize an index already exists and adds a duplicate one
    // each time. So alter-sync is now opt-in via DB_SYNC_ALTER=true in .env.
    // Leave it unset for normal day-to-day restarts; set it to true only
    // for the one restart right after you change a model, then unset it
    // again. Replace with proper migrations before production use.
    const shouldAlter = process.env.DB_SYNC_ALTER === "true";
    await sequelize.sync(shouldAlter ? { alter: true } : {});
    console.log(shouldAlter ? "Models synced (alter)." : "Models synced.");

    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

    // getSettingsRow() expires a due schedule as a side effect (see
    // settingsController.expireSchedule) — it's a notification only and
    // never turns maintenance mode on by itself. Requests already trigger
    // this naturally, but a quiet system with no traffic could otherwise
    // keep showing a stale "upcoming maintenance" notice past its time —
    // this backstop keeps the delay to ~20s regardless.
    setInterval(() => {
      getSettingsRow().catch((err) => console.error("Scheduled maintenance check failed:", err.message));
    }, 20000);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
