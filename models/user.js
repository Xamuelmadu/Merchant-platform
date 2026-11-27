const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema(
  {
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
    LEGACY USER PLAN
    --------------------------------

    Retained for compatibility with
    existing records and integrations.

    Store.plan is authoritative for
    paid subscription entitlement.
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
    },

    /*
    --------------------------------
    REGISTRATION TRIAL LIFECYCLE
    --------------------------------

    The trial begins at successful
    registration, not store connection.

    Trial dates must be initialized
    by the registration controller.

    Never restart the trial on login,
    store connection or reconnection.
    */

    trial_started_at: {
      type: Date,
      default: null
    },

    trial_ends_at: {
      type: Date,
      default: null,
      index: true
    },

    trial_status: {
      type: String,
      enum: [
        "active",
        "expired",
        "converted"
      ],
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model(
  "User",
  UserSchema
)