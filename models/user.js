const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({

  /*
  --------------------------------
  BASIC IDENTITY
  --------------------------------
  */

  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },

  password: {
    type: String,
    required: false,
    default: null
  },

  /*
  --------------------------------
  EMAIL VERIFICATION
  --------------------------------
  */

  email_verified: {
    type: Boolean,
    default: false,
    index: true
  },

  email_verified_at: {
    type: Date,
    default: null
  },

  /*
  --------------------------------
  IDENTITY SOURCE
  --------------------------------
  */

  identity_provider: {
    type: String,
    enum: [
      "email",
      "shopify",
      "woocommerce"
    ],
    default: "email",
    index: true
  },

  /*
  --------------------------------
  PLAN
  --------------------------------
  */

  plan: {
    type: String,
    enum: [
      "free",
      "basic",
      "pro",
      "premium"
    ],
    default: "free"
  }

}, {
  timestamps: true
})

module.exports =
  mongoose.model(
    "User",
    UserSchema
  )