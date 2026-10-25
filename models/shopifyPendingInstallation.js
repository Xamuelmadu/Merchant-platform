const mongoose = require("mongoose");

const ShopifyPendingInstallationSchema = new mongoose.Schema(
  {
    token_hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    shop_id: {
      type: String,
      required: true,
    },

    shop_domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    shop_name: {
      type: String,
      default: "",
    },

    shop_email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },

    currency: {
      type: String,
      required: true,
    },

    used_at: {
      type: Date,
      default: null,
    },

    expires_at: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

ShopifyPendingInstallationSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "ShopifyPendingInstallation",
  ShopifyPendingInstallationSchema
);