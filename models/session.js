const mongoose = require("mongoose")

const SessionSchema = new mongoose.Schema({

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  refresh_token: {
    type: String,
    required: true
  },

  user_agent: String,
  ip_address: String,

  expires_at: {
    type: Date,
    required: true
  }

}, { timestamps: true })

module.exports = mongoose.model("Session", SessionSchema)