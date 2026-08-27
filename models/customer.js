const mongoose = require("mongoose")


const CustomerSchema = new mongoose.Schema({

  /*
  --------------------------------
  STORE RELATION
  --------------------------------
  */

  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    index: true
  },


  /*
  --------------------------------
  EXTERNAL CUSTOMER ID
  --------------------------------

  Shopify / WooCommerce / other
  platform customer identifier.
  --------------------------------
  */

  external_id: {
    type: String,
    index: true
  },


  /*
  --------------------------------
  SOURCE PLATFORM
  --------------------------------
  */

  source: {
    type: String,

    enum: [
      "manual",
      "shopify",
      "woocommerce",
      "whatsapp",
      "custom"
    ],

    default: "manual",

    index: true
  },


  /*
  --------------------------------
  CUSTOMER INFO
  --------------------------------
  */

  name: {
    type: String,
    trim: true,
    default: ""
  },

  phone: {
    type: String,
    trim: true,
    default: ""
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ""
  },


  /*
  --------------------------------
  WHATSAPP INFO
  --------------------------------
  */

  whatsapp_id: {
    type: String,
    index: true
  },


  /*
  --------------------------------
  CUSTOMER ACTIVITY
  --------------------------------
  */

  last_message_at: {
    type: Date
  },

  first_seen: {
    type: Date,
    default: Date.now
  },

  last_seen: {
    type: Date,
    default: Date.now
  },


  /*
  --------------------------------
  CUSTOMER VALUE
  --------------------------------
  */

  total_orders: {
    type: Number,
    default: 0
  },

  total_spent: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  CUSTOMER TAGGING
  --------------------------------
  */

  tags: {
    type: [String],
    default: []
  }

}, {
  timestamps: true
})


/*
================================
INDEXES
================================
*/


/*
Store + source + external customer
ID uniquely identifies an imported
customer.
*/

CustomerSchema.index({

  store_id: 1,

  source: 1,

  external_id: 1

}, {
  unique: true,
  sparse: true
})


/*
Prevent duplicate manually-created
customers by phone.

Sparse allows Shopify customers
without phone numbers.
*/

CustomerSchema.index({

  store_id: 1,

  phone: 1

}, {
  unique: true,
  sparse: true
})


/*
Analytics.
*/

CustomerSchema.index({
  store_id: 1,
  total_spent: -1
})

CustomerSchema.index({
  store_id: 1,
  total_orders: -1
})


module.exports =
  mongoose.model(
    "Customer",
    CustomerSchema
  )