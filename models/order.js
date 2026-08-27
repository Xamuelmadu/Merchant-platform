const mongoose = require("mongoose")


/*
================================
ORDER ITEM
================================
*/

const OrderItemSchema =
  new mongoose.Schema({

    product_id: {
      type:
        mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    external_product_id: {
      type: String,
      default: ""
    },

    external_variant_id: {
      type: String,
      default: ""
    },

    name: {
      type: String,
      default: ""
    },

    variant_name: {
      type: String,
      default: ""
    },

    sku: {
      type: String,
      default: ""
    },

    quantity: {
      type: Number,
      default: 1
    },

    unit_price: {
      type: Number,
      default: 0
    },

    total_price: {
      type: Number,
      default: 0
    }

  }, {
    _id: false
  })


/*
================================
ORDER
================================
*/

const OrderSchema =
  new mongoose.Schema({

    /*
    --------------------------------
    STORE
    --------------------------------
    */

    store_id: {
      type:
        mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true
    },


    /*
    --------------------------------
    EXTERNAL ORDER ID
    --------------------------------
    */

    external_id: {
      type: String,
      index: true
    },


    /*
    --------------------------------
    SOURCE
    --------------------------------
    */

    source: {
      type: String,

      enum: [
        "manual",
        "shopify",
        "woocommerce",
        "custom"
      ],

      default: "manual",

      index: true
    },


    /*
    --------------------------------
    ORDER NUMBER
    --------------------------------
    */

    order_number: {
      type: String,
      default: ""
    },


    /*
    --------------------------------
    CUSTOMER
    --------------------------------
    */

    customer_id: {
      type:
        mongoose.Schema.Types.ObjectId,
      ref: "Customer"
    },

    external_customer_id: {
      type: String,
      default: ""
    },

    customer_name: {
      type: String,
      default: ""
    },

    customer_email: {
      type: String,
      default: ""
    },

    customer_phone: {
      type: String,
      default: ""
    },

    customer_address: {
      type: String,
      default: ""
    },


    /*
    --------------------------------
    PRODUCTS
    --------------------------------
    */

    items: {
      type: [OrderItemSchema],
      default: []
    },


    /*
    --------------------------------
    LEGACY SINGLE PRODUCT FIELDS
    --------------------------------

    Retained so the existing manual
    order system continues working.
    --------------------------------
    */

    product_id: {
      type:
        mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    quantity: {
      type: Number,
      default: 1
    },


    /*
    --------------------------------
    FINANCIALS
    --------------------------------
    */

    subtotal: {
      type: Number,
      default: 0
    },

    total_price: {
      type: Number,
      default: 0
    },

    currency: {
      type: String,
      default: "USD"
    },

    platform_fee: {
      type: Number,
      default: 0
    },

    merchant_payout: {
      type: Number,
      default: 0
    },


    /*
    --------------------------------
    PAYMENT
    --------------------------------
    */

    payment_reference: {
      type: String,
      default: ""
    },

    payment_status: {
      type: String,

      enum: [
        "pending",
        "partial",
        "paid",
        "refunded",
        "cancelled"
      ],

      default: "pending"
    },


    /*
    --------------------------------
    ORDER STATUS
    --------------------------------
    */

    order_status: {
      type: String,

      enum: [
        "new",
        "paid",
        "completed",
        "cancelled"
      ],

      default: "new"
    },


    /*
    --------------------------------
    SHOPIFY DATES
    --------------------------------
    */

    ordered_at: {
      type: Date
    },

    fulfilled_at: {
      type: Date
    },

    cancelled_at: {
      type: Date
    }

  }, {
    timestamps: true
  })


/*
================================
INDEXES
================================
*/


OrderSchema.index({

  store_id: 1,

  source: 1,

  external_id: 1

}, {
  unique: true,
  sparse: true
})


OrderSchema.index({
  store_id: 1,
  createdAt: -1
})


OrderSchema.index({
  store_id: 1,
  order_status: 1
})


OrderSchema.index({
  store_id: 1,
  customer_id: 1
})


module.exports =
  mongoose.model(
    "Order",
    OrderSchema
  )