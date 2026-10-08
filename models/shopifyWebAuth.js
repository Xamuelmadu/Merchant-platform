const mongoose = require("mongoose")

const ShopifyWebAuthSchema =
  new mongoose.Schema(
    {
      token_hash: {
        type: String,
        required: true,
        unique: true,
        index: true
      },

      merchant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
      },

      return_url: {
        type: String,
        required: true
      },

      expires_at: {
        type: Date,
        required: true,
        index: true
      },

      used: {
        type: Boolean,
        default: false,
        index: true
      },

      used_at: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  )

ShopifyWebAuthSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
)

module.exports =
  mongoose.model(
    "ShopifyWebAuth",
    ShopifyWebAuthSchema
  )