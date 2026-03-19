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
CONNECT DATABASE
--------------------------------
*/

connectDB()

/*
--------------------------------
GLOBAL MIDDLEWARE
--------------------------------
*/

// FIX 1: Update CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || true  // Allow your frontend URL or any origin in production
    : "http://localhost:3000"
}))

app.use(express.json())

/*
--------------------------------
API ROUTES
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
    environment: process.env.NODE_ENV || 'development'
  })
})

// FIX 2: Add a health check endpoint (Railway uses this)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" })
})

/*
--------------------------------
CRON JOBS
--------------------------------
Runs every day at midnight
--------------------------------
*/

// FIX 3: Only run cron jobs in production if you want, or adjust as needed
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CRON === 'true') {
  cron.schedule("0 0 * * *", async () => {
    console.log("Running billing cycle...")
    try {
      await runMonthlyBilling()
      console.log("Billing cycle completed successfully")
    } catch (error) {
      console.error("Billing cycle failed:", error)
    }
  })
  console.log("Cron jobs scheduled")
}

/*
--------------------------------
ERROR HANDLING
--------------------------------
*/

// FIX 4: Add global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  })
})

// FIX 5: Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

/*
--------------------------------
START SERVER
--------------------------------
*/

const PORT = process.env.PORT || 5000

// FIX 6: Listen on 0.0.0.0 for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Merchant platform running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

// FIX 7: Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
  })
})