require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser"); // added by farah for handling cookies (refresh token) in auth routes
// Added by Farah
const notificationRoutes = require("./modules/notification/notification.routes");
const auditRoutes = require("./modules/audit/audit.routes");
const sessionRoutes = require("./modules/session/session.routes");
const securityRoutes = require("./modules/security/security.routes");
const aiStatsRoutes = require("./modules/ai-stats/ai-stats.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const doctorDashboardRoutes = require("./modules/dashboard/doctor-dashboard.routes");
const analyticsRoutes = require("./modules/analytics/analytics.routes");
const watchlistRoutes = require("./modules/watchlist/watchlist.routes");
const followupRoutes = require("./modules/followup/followup.routes");
const chatRoutes = require("./modules/chat/chat.routes");
const receptionRoutes = require("./modules/reception/reception.routes");
// End of added routes
const app = express();
app.set("trust proxy", true);

// ================= CORS =================
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3001",
      "http://localhost:3000",
      "https://final-project-biqc.vercel.app"
    ],

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ================= PREFLIGHT =================
app.options("*", cors());

// ================= BODY PARSER =================
app.use(express.json());


// ================= STATIC FILES =================
// app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ================= COOKIE PARSER [added by farah] =================
app.use(cookieParser());

// ================= ROUTES =================

// Added Notification by Farah
app.use("/notifications", notificationRoutes);
// Added logs by Farah
app.use("/audit-logs", auditRoutes);

// Added routes by Farah
app.use("/api/admin/sessions", sessionRoutes);
app.use("/api/admin/security", securityRoutes);
app.use("/api/admin/ai", aiStatsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/analytics", analyticsRoutes);

// doctor routes
app.use("/api/dashboard", doctorDashboardRoutes); // GET /api/dashboard, /performance
app.use("/api/watchlist", watchlistRoutes); // GET/POST/DELETE/PATCH /api/watchlist
app.use("/api/followup", followupRoutes); // GET/POST/PATCH/DELETE /api/followup
app.use("/api/chat", chatRoutes); // GET/POST /api/chat
app.use("/api/doctor/schedule", require("./modules/doctor-schedule/doctor-schedule.routes"));
app.use("/api/reception", receptionRoutes); // Reception workspace
// End of added routes

app.use("/auth", require("./modules/auth/auth.routes"));
app.use("/users", require("./modules/users/user.routes"));
app.use("/patients", require("./modules/patients/patient.routes"));
app.use("/studies", require("./modules/studies/study.routes"));
app.use("/reports", require("./modules/reports/report.routes"));
app.use("/ai", require("./modules/ai/ai.routes"));

// ================= ERROR MIDDLEWARE =================
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  const status = err.status || 500;
  const message =
    err.message ||
    (typeof err === "string" ? err : "Internal Server Error");

  res.status(status).json({
    success: false,
    message,
    error: err.error || undefined,
    field: err.field || undefined,
  });
});

module.exports = app;
