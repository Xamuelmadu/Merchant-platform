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

app.use(cors({
  origin: "http://localhost:3000"
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

app.get("/", (req,res)=>{
  res.send("Merchant platform API running")
})


/*
--------------------------------
CRON JOBS
--------------------------------
Runs every day at midnight
--------------------------------
*/

cron.schedule("0 0 * * *", async () => {

  console.log("Running billing cycle...")

  await runMonthlyBilling()

})


/*
--------------------------------
START SERVER
--------------------------------
*/

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Merchant platform running on port ${PORT}`)
})