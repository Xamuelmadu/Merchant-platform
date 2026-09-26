const mongoose = require("mongoose")


/*
================================
PRODUCT VARIANT
================================
*/

const ProductVariantSchema =
  new mongoose.Schema({

    /*
    --------------------------------
    EXTERNAL VARIANT ID
    --------------------------------
    */

    external_id: {

      type: String,

      required: true

    },


    /*
    --------------------------------
    VARIANT TITLE
    --------------------------------
    */

    title: {

      type: String,

      default: ""

    },


    /*
    --------------------------------
    SKU
    --------------------------------
    */

    sku: {

      type: String,

      default: ""

    },


    /*
    --------------------------------
    PRICE
    --------------------------------
    */

    price: {

      type: Number,

      default: 0

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
    AVAILABILITY
    --------------------------------
    */

    available: {

      type: Boolean,

      default: true

    },


    /*
    --------------------------------
    ATTRIBUTES
    --------------------------------

    Examples:

    Size: M
    Color: Black
    Material: Cotton
    --------------------------------
    */

    attributes: {

      type: Map,

      of: String,

      default: {}

    }

  }, {

    _id: false

  })


/*
================================
PRODUCT
================================
*/

const ProductSchema =
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
    PLATFORM PRODUCT ID
    --------------------------------

    This is the canonical external
    product identifier.

    Shopify:
    Shopify product ID

    WooCommerce:
    WooCommerce product ID
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

      type: [
        ProductVariantSchema
      ],

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
================================
INDEXES
================================
*/


/*
--------------------------------
EXTERNAL PRODUCT IDENTITY
--------------------------------

A product is unique within a store
and source platform.

Example:

Store A + Shopify + 123
Store A + WooCommerce + 123

are two different products.

But:

Store A + Shopify + 123

cannot exist twice.
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


/*
--------------------------------
STORE PRODUCT LOOKUP
--------------------------------
*/

ProductSchema.index({

  store_id: 1,

  createdAt: -1

})


/*
--------------------------------
STORE + SOURCE
--------------------------------
*/

ProductSchema.index({

  store_id: 1,

  source: 1

})


/*
================================
MODEL
================================
*/

module.exports =
  mongoose.model(
    "Product",
    ProductSchema
  )