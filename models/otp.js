const mongoose = require("mongoose")

const OtpSchema = new mongoose.Schema({

  email: {
    type: String,
    required: true,
    index: true
  },

  otp: {
    type: String,
    required: true
  },

  expires_at: {
    type: Date,
    required: true
  }

}, { timestamps: true })

module.exports = mongoose.model("Otp", OtpSchema)