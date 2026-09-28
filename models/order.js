const mongoose = require("mongoose")


/*
================================
ORDER ITEM SCHEMA
================================
*/

const OrderItemSchema = new mongoose.Schema(
  {

    /*
    --------------------------------
    INTERNAL PRODUCT
    --------------------------------
    */

    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
      index: true
    },


    /*
    --------------------------------
    EXTERNAL PRODUCT
    --------------------------------

    Shopify / WooCommerce product ID.
    */

    external_product_id: {
      type: String,
      default: "",
      trim: true
    },


    /*
    --------------------------------
    PRODUCT INFORMATION SNAPSHOT
    --------------------------------

    These values are intentionally
    stored on the order so historical
    orders remain readable even if the
    product later changes.
    */

    name: {
      type: String,
      default: "",
      trim: true
    },

    sku: {
      type: String,
      default: "",
      trim: true
    },


    /*
    --------------------------------
    QUANTITY
    --------------------------------
    */

    quantity: {
      type: Number,
      required: true,
      min: 1
    },


    /*
    --------------------------------
    PRICING SNAPSHOT
    --------------------------------
    */

    unit_price: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },

    total_price: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }

  },
  {
    _id: false
  }
)


/*
================================
ORDER SCHEMA
================================
*/

const OrderSchema = new mongoose.Schema(
  {

    /*
    --------------------------------
    STORE
    --------------------------------

    Every order belongs to exactly
    one Merchant Platform store.
    */

    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true
    },


    /*
    --------------------------------
    ORDER SOURCE
    --------------------------------

    Where the order originated.

    Shopify
    WooCommerce
    Custom / AI
    Manual
    */

    source: {
      type: String,
      enum: [
        "shopify",
        "woocommerce",
        "custom",
        "manual"
      ],
      default: "custom",
      required: true,
      index: true
    },


    /*
    --------------------------------
    EXTERNAL ORDER IDENTIFIERS
    --------------------------------

    Used for Shopify / WooCommerce
    order synchronization.
    */

    external_id: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    order_number: {
      type: String,
      default: "",
      trim: true,
      index: true
    },


    /*
    --------------------------------
    CUSTOMER
    --------------------------------
    */

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
      index: true
    },

    external_customer_id: {
      type: String,
      default: "",
      trim: true,
      index: true
    },


    /*
    --------------------------------
    CUSTOMER SNAPSHOT
    --------------------------------

    Keep these values on the order
    because customer information can
    change after the order is created.
    */

    customer_name: {
      type: String,
      default: "",
      trim: true
    },

    customer_email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true
    },

    customer_phone: {
      type: String,
      default: "",
      trim: true
    },

    customer_address: {
      type: String,
      default: "",
      trim: true
    },


    /*
    --------------------------------
    ORDER ITEMS
    --------------------------------
    */

    items: {
      type: [OrderItemSchema],
      default: []
    },


    /*
    --------------------------------
    LEGACY PRODUCT FIELDS
    --------------------------------

    Retained for compatibility with
    existing controllers and older
    orders.

    New multi-item orders should use
    `items`.
    */

    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
      index: true
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1
    },


    /*
    --------------------------------
    FINANCIAL SNAPSHOT
    --------------------------------

    These values represent the
    financial state of the order when
    it was created.

    Historical orders must NOT depend
    on the Store's current transaction
    fee or currency.
    */

    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },

    total_price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      index: true
    },


    /*
    --------------------------------
    ORDER CURRENCY
    --------------------------------

    Currency at the time the order
    was created.

    Do NOT calculate historical
    financials from Store.currency.
    */

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true
    },


    /*
    --------------------------------
    PLATFORM FEE
    --------------------------------

    Fee charged to the merchant for
    this specific order.

    This is a historical snapshot.
    */

    platform_fee: {
      type: Number,
      default: 0,
      min: 0
    },


    /*
    --------------------------------
    MERCHANT PAYOUT
    --------------------------------

    Merchant earnings after the
    platform fee for this order.
    */

    merchant_payout: {
      type: Number,
      default: 0,
      min: 0
    },


    /*
    --------------------------------
    PAYMENT
    --------------------------------
    */

    payment_status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "cancelled"
      ],
      default: "pending",
      index: true
    },

    payment_reference: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    payment_gateway: {
      type: String,
      default: "",
      trim: true
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
      default: "new",
      index: true
    },


    /*
    --------------------------------
    ORDER DATES
    --------------------------------
    */

    ordered_at: {
      type: Date,
      default: Date.now,
      index: true
    },

    fulfilled_at: {
      type: Date
    },

    cancelled_at: {
      type: Date
    }

  },
  {

    /*
    --------------------------------
    TIMESTAMPS
    --------------------------------

    Use snake_case because the existing
    controllers query `created_at` and
    `updated_at`.
    */

    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }

  }
)


/*
================================
INDEXES
================================
*/


/*
Store order lookup
*/

OrderSchema.index({
  store_id: 1,
  created_at: -1
})


/*
Store + status lookup

Used heavily by dashboard and
financial queries.
*/

OrderSchema.index({
  store_id: 1,
  order_status: 1,
  created_at: -1
})


/*
Store + payment status
*/

OrderSchema.index({
  store_id: 1,
  payment_status: 1,
  created_at: -1
})


/*
External order synchronization

Prevents repeated searches from
becoming expensive when syncing
Shopify/WooCommerce orders.
*/

OrderSchema.index({
  store_id: 1,
  source: 1,
  external_id: 1
})


/*
Customer order lookup
*/

OrderSchema.index({
  store_id: 1,
  customer_id: 1,
  created_at: -1
})


/*
================================
MODEL
================================
*/

module.exports =
  mongoose.models.Order ||
  mongoose.model(
    "Order",
    OrderSchema
  )