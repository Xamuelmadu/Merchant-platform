const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    unique: true,
    required: true
  },

  password: {
    type: String,
    required: true
  },

  plan: {
    type: String,
    enum: ["free", "basic", "pro", "premium"],
    default: "free"
  }

}, {
  timestamps: true
})

module.exports = mongoose.model("User", UserSchema)