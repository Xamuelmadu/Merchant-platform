require("dotenv").config()

const express = require("express")
const cors = require("cors")
const cron = require("node-cron")

const passport = require("passport")
require("./config/passport")

app.use(passport.initialize())

const cookieParser = require("cookie-parser")
app.use(cookieParser())

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
ENV VALIDATION
--------------------------------
*/

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "PAYSTACK_SECRET",
  "STRIPE_SECRET"
]

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`)
    process.exit(1)
  }
})

/*
--------------------------------
GLOBAL ERROR HANDLING
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
BOOTSTRAP SERVER
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
  CORS CONFIG
  --------------------------------
  */

  app.use(cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL
      : "http://localhost:3000",
    credentials: true
  }))

  /*
  --------------------------------
  STRIPE WEBHOOK RAW BODY (CRITICAL)
  --------------------------------
  */

  app.use("/webhooks/stripe", express.raw({ type: "application/json" }))

  /*
  --------------------------------
  BODY PARSER
  --------------------------------
  */

  app.use(express.json({ limit: "10mb" }))

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
  CRON JOBS (MONTHLY)
  --------------------------------
  */

const { runMonthlyBilling } = require("./services/billingService")
const { checkSubscriptions } = require("./cron/subscriptionCron")

if (process.env.ENABLE_CRON === "true") {

  console.log("✅ Cron jobs enabled")

  /*
  --------------------------------
  1. PLATFORM FEES (MONTHLY)
  Runs 1st of every month at 00:00
  --------------------------------
  */
  cron.schedule("0 0 1 * *", async () => {

    console.log("⏳ Running platform fee billing...")

    try {
      await runMonthlyBilling()
      console.log("✅ Platform fees charged")
    } catch (error) {
      console.error("❌ Billing failed:", error.message)
    }

  })


  /*
  --------------------------------
  2. SUBSCRIPTION EXPIRY CHECK
  Runs EVERY HOUR
  --------------------------------
  */
  cron.schedule("0 * * * *", async () => {

    console.log("⏳ Checking subscription expiry...")

    try {
      await checkSubscriptions()
      console.log("✅ Subscription check complete")
    } catch (error) {
      console.error("❌ Subscription check failed:", error.message)
    }

  })


  /*
  --------------------------------
  3. SAFETY RECONCILIATION (OPTIONAL)
  Re-run billing daily to catch failures
  --------------------------------
  */
  cron.schedule("0 2 * * *", async () => {

    console.log("⏳ Running billing reconciliation...")

    try {
      await runMonthlyBilling()
      console.log("✅ Reconciliation complete")
    } catch (error) {
      console.error("❌ Reconciliation failed:", error.message)
    }

  })

}

  /*
  --------------------------------
  ERROR HANDLER
  --------------------------------
  */

  app.use((err, req, res, next) => {
    console.error("❌ Error:", err.stack)

    res.status(err.status || 500).json({
      error: "Server error",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message
    })
  })

  /*
  --------------------------------
  404 HANDLER
  --------------------------------
  */

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found" })
  })

  /*
  --------------------------------
  START SERVER
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

  const shutdown = () => {
    console.log("⚠️ Shutdown signal received")
    server.close(() => {
      console.log("✅ Server closed")
      process.exit(0)
    })
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

}

/*
--------------------------------
START APP
--------------------------------
*/

startServer()