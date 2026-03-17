const mongoose = require("mongoose")

const StoreSchema = new mongoose.Schema({

  /*
  --------------------------------
  MERCHANT OWNER
  --------------------------------
  */

  merchant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Merchant",
    required: true,
    index: true
  },


  /*
  --------------------------------
  BASIC STORE INFO
  --------------------------------
  */

  store_name: {
    type: String,
    required: true,
    trim: true
  },

  whatsapp_number: {
    type: String,
    trim: true
  },

  industry: {
    type: String,
    default: "ecommerce"
  },


  /*
  --------------------------------
  PLATFORM SUBSCRIPTION
  --------------------------------
  */

  plan: {
    type: String,
    enum: ["free", "starter", "growth", "scale"],
    default: "free",
    index: true
  },

  subscription_status: {
    type: String,
    enum: ["inactive", "active", "past_due", "cancelled"],
    default: "inactive",
    index: true
  },

  subscription_renewal: {
    type: Date
  },

  billing_grace_until: {
    type: Date
  },

  system_locked: {
    type: Boolean,
    default: false
  },


  /*
  --------------------------------
  ORDER LIMITS
  --------------------------------
  */

  monthly_order_limit: {
    type: Number,
    default: 20
  },

  orders_used: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  PLATFORM FEES
  --------------------------------
  */

  transaction_fee: {
    type: Number,
    default: 0.007
  },

  total_platform_fees: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  STRIPE BILLING
  --------------------------------
  */

  stripe_customer_id: {
    type: String
  },

  stripe_payment_method: {
    type: String
  },


  /*
  --------------------------------
  PAYSTACK BILLING
  --------------------------------
  */

  paystack_customer_code: {
    type: String
  },

  paystack_authorization_code: {
    type: String
  },


  /*
  --------------------------------
  MERCHANT PAYMENT KEYS
  --------------------------------
  */

  paystack_public_key: String,
  paystack_secret_key: String,

  stripe_public_key: String,
  stripe_secret_key: String

},{
  timestamps: true
})



module.exports = mongoose.model("Store", StoreSchema)