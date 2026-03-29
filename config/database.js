const mongoose = require("mongoose")

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI)

    console.log("MongoDB connected")
  } catch (error) {
    console.error("MongoDB connection error:", error.message)
    process.exit(1) // crash fast on failure (Railway best practice)
  }
}

module.exports = connectDB