const mongoose = require("mongoose")

const ProductVariantSchema = new mongoose.Schema({

  external_id: {
    type: String,
    required: true
  },

  title: {
    type: String,
    default: ""
  },

  sku: {
    type: String,
    default: ""
  },

  price: {
    type: Number,
    default: 0
  },

  stock: {
    type: Number,
    default: 0
  },

  available: {
    type: Boolean,
    default: true
  },

  attributes: {
    type: Map,
    of: String,
    default: {}
  }

}, {
  _id: false
})


const ProductSchema = new mongoose.Schema({

  /*
  --------------------------------
  STORE
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
  PLATFORM PRODUCT ID
  --------------------------------
  */

  external_id: {
    type: String,
    index: true
  },


  /*
  --------------------------------
  BASIC PRODUCT DATA
  --------------------------------
  */

  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    default: ""
  },


  /*
  --------------------------------
  PRICING
  --------------------------------
  */

  price: {
    type: Number,
    default: 0
  },

  currency: {
    type: String,
    default: "USD"
  },


  /*
  --------------------------------
  INVENTORY
  --------------------------------
  */

  stock: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  IMAGES
  --------------------------------
  */

  images: {
    type: [String],
    default: []
  },


  /*
  --------------------------------
  PRODUCT URL
  --------------------------------
  */

  product_url: {
    type: String,
    default: ""
  },


  /*
  --------------------------------
  VARIANTS
  --------------------------------
  */

  variants: {
    type: [ProductVariantSchema],
    default: []
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
      "custom"
    ],

    default: "manual",

    index: true
  }

}, {
  timestamps: true
})


/*
--------------------------------
PRODUCT ID INDEX
--------------------------------
*/

ProductSchema.index({
  store_id: 1,
  source: 1,
  external_id: 1
}, {
  unique: true,
  sparse: true
})


module.exports =
  mongoose.model(
    "Product",
    ProductSchema
  )