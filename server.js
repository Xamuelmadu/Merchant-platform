require("dotenv").config()

const express = require("express")
const cors = require("cors")
const cron = require("node-cron")

const connectDB = require("./config/database")

const authRoutes = require("./routes/authRoutes")
const storeRoutes = require("./routes/storeRoutes")
const productRoutes = require("./routes/productRoutes")
const orderRoutes = require("./routes/orderRoutes")
const paymentRoutes = require("./routes/paymentRoutes")
const engineRoutes = require("./routes/engineRoutes")
const analyticsRoutes = require("./routes/analyticsRoutes")
const billingRoutes = require("./routes/billingRoutes")
const webhookRoutes = require("./routes/webhookRoutes")
const integrationRoutes = require("./routes/integrationRoutes")

const { runMonthlyBilling } = require("./services/billingEngine")

const app = express()

/*
--------------------------------
ENV VALIDATION (CRITICAL FIX)
--------------------------------
*/

const requiredEnv = ["MONGO_URI"]

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`)
    process.exit(1) // HARD STOP → prevents silent Railway crash
  }
})

/*
--------------------------------
GLOBAL ERROR SAFETY
--------------------------------
*/

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err)
})

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err)
})

/*
--------------------------------
CONNECT DATABASE (SAFE)
--------------------------------
*/

async function startServer() {
  try {
    await connectDB()
    console.log("✅ Database connected")
  } catch (err) {
    console.error("❌ Database connection failed:", err.message)
    process.exit(1)
  }

  /*
  --------------------------------
  MIDDLEWARE
  --------------------------------
  */

  app.use(cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL || "*"
      : "http://localhost:3000"
  }))

  app.use(express.json())

  /*
  --------------------------------
  ROUTES
  --------------------------------
  */

  app.use("/api/auth", authRoutes)
  app.use("/api/store", storeRoutes)
  app.use("/api/products", productRoutes)
  app.use("/api/orders", orderRoutes)
  app.use("/api/payments", paymentRoutes)
  app.use("/api/engine", engineRoutes)
  app.use("/api/analytics", analyticsRoutes)
  app.use("/api/billing", billingRoutes)
  app.use("/webhooks", webhookRoutes)
  app.use("/api/integrations", integrationRoutes)

  /*
  --------------------------------
  HEALTH CHECK
  --------------------------------
  */

  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      message: "Merchant platform API running",
      environment: process.env.NODE_ENV || "development"
    })
  })

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" })
  })

  /*
  --------------------------------
  CRON JOBS (SAFE)
  --------------------------------
  */

  if (process.env.ENABLE_CRON === "true") {
    cron.schedule("0 0 * * *", async () => {
      console.log("⏳ Running billing cycle...")
      try {
        await runMonthlyBilling()
        console.log("✅ Billing cycle completed")
      } catch (error) {
        console.error("❌ Billing failed:", error.message)
      }
    })

    console.log("✅ Cron jobs enabled")
  }

  /*
  --------------------------------
  ERROR HANDLING
  --------------------------------
  */

  app.use((err, req, res, next) => {
    console.error("❌ Error:", err.stack)
    res.status(500).json({
      error: "Server error",
      message: process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message
    })
  })

  app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found" })
  })

  /*
  --------------------------------
  START SERVER (RAILWAY SAFE)
  --------------------------------
  */

  const PORT = process.env.PORT || 3000

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  })

  /*
  --------------------------------
  GRACEFUL SHUTDOWN
  --------------------------------
  */

  process.on("SIGTERM", () => {
    console.log("⚠️ SIGTERM received")
    server.close(() => {
      console.log("✅ Server closed")
    })
  })
}

/*
--------------------------------
BOOTSTRAP
--------------------------------
*/

startServer()