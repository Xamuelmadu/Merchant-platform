const mongoose = require("mongoose")

const ShopifyAuthHandoffSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "connection_intent",
        "login_handoff"
      ],
      required: true,
      index: true
    },

    token_hash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true
    },

    shop_id: {
      type: String,
      default: null,
      index: true
    },

    shop_domain: {
      type: String,
      default: null,
      lowercase: true,
      trim: true
    },

    used_at: {
      type: Date,
      default: null
    },

    expires_at: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
)

ShopifyAuthHandoffSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
)

module.exports =
  mongoose.model(
    "ShopifyAuthHandoff",
    ShopifyAuthHandoffSchema
  )