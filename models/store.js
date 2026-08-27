const mongoose = require("mongoose")

const StoreSchema = new mongoose.Schema({

  /*
  --------------------------------
  MERCHANT OWNER
  --------------------------------
  */

merchant_id: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
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

  industry: {
    type: String,
    default: "ecommerce"
  },


  /*
  --------------------------------
  COMMERCE PLATFORM
  --------------------------------
  */

  platform: {
    type: String,
    enum: [
      "shopify",
      "woocommerce",
      "other"
    ],
    default: "other",
    index: true
  },

  platform_connected: {
    type: Boolean,
    default: false,
    index: true
  },

  platform_connection_status: {
    type: String,
    enum: [
      "disconnected",
      "connecting",
      "connected",
      "error"
    ],
    default: "disconnected",
    index: true
  },

  platform_last_sync: {
    type: Date
  },

  platform_sync_error: {
    type: String
  },


  /*
  --------------------------------
  SHOPIFY INTEGRATION
  --------------------------------
  */

  shopify: {

    shop_id: {
      type: String,
      index: true
    },

    shop_domain: {
      type: String,
      index: true
    },

    access_token: {
      type: String
    },

    connected: {
      type: Boolean,
      default: false
    },

    last_product_sync: {
      type: Date
    },

    last_order_sync: {
      type: Date
    },

    last_inventory_sync: {
      type: Date
    }

  },


  /*
  --------------------------------
  WOOCOMMERCE INTEGRATION
  --------------------------------
  */

  woocommerce: {

    store_url: {
      type: String,
      trim: true
    },

    consumer_key: {
      type: String
    },

    consumer_secret: {
      type: String
    },

    connected: {
      type: Boolean,
      default: false
    },

    last_product_sync: {
      type: Date
    },

    last_order_sync: {
      type: Date
    },

    last_inventory_sync: {
      type: Date
    }

  },


  /*
  --------------------------------
  PLATFORM SUBSCRIPTION
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
    default: "free",
    index: true
  },

  subscription_status: {
    type: String,
    enum: [
      "inactive",
      "active",
      "past_due",
      "cancelled"
    ],
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
  STRIPE PLATFORM BILLING
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
  PAYSTACK PLATFORM BILLING
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
  MERCHANT PAYMENT SETTINGS
  --------------------------------
  */

  paystack_public_key: {
    type: String
  },

  paystack_secret_key: {
    type: String
  },

  stripe_public_key: {
    type: String
  },

  stripe_secret_key: {
    type: String
  },


  /*
  --------------------------------
  WHATSAPP
  --------------------------------
  TEMPORARILY RETAINED
  --------------------------------
  */

  whatsapp_number: {
    type: String,
    trim: true
  },

  whatsapp_connected: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true
})


/*
--------------------------------
INDEXES
--------------------------------
*/

StoreSchema.index({
  merchant_id: 1,
  platform: 1
})

StoreSchema.index({
  "shopify.shop_domain": 1
})

StoreSchema.index({
  "woocommerce.store_url": 1
})


module.exports = mongoose.model("Store", StoreSchema)