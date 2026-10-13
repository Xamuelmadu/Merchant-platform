const mongoose = require("mongoose");

const WooCommerceAuthHandoffSchema = new mongoose.Schema(
  {
    token_hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    merchant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    store_url: {
      type: String,
      required: true,
    },

    callback_url: {
      type: String,
      required: true,
    },

    state_hash: {
      type: String,
      required: true,
    },

    expires_at: {
      type: Date,
      required: true,
      index: true,
    },

    used_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

WooCommerceAuthHandoffSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);

module.exports =
  mongoose.models.WooCommerceAuthHandoff ||
  mongoose.model(
    "WooCommerceAuthHandoff",
    WooCommerceAuthHandoffSchema
  );