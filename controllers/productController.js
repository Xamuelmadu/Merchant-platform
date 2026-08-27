const Product = require("../models/product")
const Store = require("../models/store")

const { importCSV } = require("../services/productImportService")
const { syncWooProducts } = require("../services/woocommerceService")
const { syncShopifyProducts } = require("../services/shopifyService")



/*
--------------------------------
ADD PRODUCT
--------------------------------
*/
async function addProduct(req, res) {
  try {

    const { name, description, price, stock = 0, image } = req.body

    if (!name || price === undefined) {
      return res.status(400).json({
        error: "Product name and price are required"
      })
    }

    if (price < 0 || stock < 0) {
      return res.status(400).json({
        error: "Invalid price or stock value"
      })
    }

    const store = req.store

    const product = await Product.create({
      store_id: store._id,
      name,
      description,
      price,
      stock,
      reserved_stock: 0,
      sold: 0,
      images: image ? [image] : [],
      source: "manual"
    })

    res.json({
      message: "Product created successfully",
      product
    })

  } catch (error) {

    console.error("Add product error:", error.message)

    res.status(500).json({
      error: "Product creation failed",
      details: error.message
    })

  }
}



/*
--------------------------------
GET PRODUCTS
--------------------------------
*/
async function getProducts(req, res) {
  try {

    const store = req.store

    const products = await Product.find({
      store_id: store._id
    }).sort({ createdAt: -1 })

    res.json(products)

  } catch (error) {

    console.error("Get products error:", error.message)

    res.status(500).json({
      error: "Failed to fetch products"
    })

  }
}



/*
--------------------------------
GET SINGLE PRODUCT
--------------------------------
*/
async function getProductById(req, res) {
  try {

    const store = req.store

    const product = await Product.findOne({
      _id: req.params.id,
      store_id: store._id
    })

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      })
    }

    res.json(product)

  } catch (error) {

    console.error("Get product error:", error.message)

    res.status(500).json({
      error: error.message
    })

  }
}



/*
--------------------------------
UPDATE PRODUCT
--------------------------------
*/
async function updateProduct(req, res) {
  try {

    const store = req.store
    const updates = req.body

    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        store_id: store._id
      },
      updates,
      { new: true }
    )

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      })
    }

    res.json({
      message: "Product updated successfully",
      product
    })

  } catch (error) {

    console.error("Update product error:", error.message)

    res.status(500).json({
      error: error.message
    })

  }
}



/*
--------------------------------
DELETE PRODUCT
--------------------------------
*/
async function deleteProduct(req, res) {
  try {

    const store = req.store

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      store_id: store._id
    })

    if (!product) {
      return res.status(404).json({
        error: "Product not found"
      })
    }

    res.json({
      message: "Product deleted successfully"
    })

  } catch (error) {

    console.error("Delete product error:", error.message)

    res.status(500).json({
      error: error.message
    })

  }
}



/*
--------------------------------
IMPORT CSV PRODUCTS
--------------------------------
*/
async function importProducts(req, res) {
  try {

    const store = req.store
    const file = req.file

    if (!file) {
      return res.status(400).json({
        error: "CSV file required"
      })
    }

    const count = await importCSV(file.path, store._id)

    res.json({
      message: `${count} products imported successfully`
    })

  } catch (error) {

    console.error("CSV import error:", error.message)

    res.status(500).json({
      error: "CSV import failed",
      details: error.message
    })

  }
}



/*
--------------------------------
SYNC WOOCOMMERCE
--------------------------------
*/
async function syncWooCommerce(req, res) {
  try {

    const store = req.store

    const {
      store_url,
      consumer_key,
      consumer_secret
    } = req.body

    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        error: "store_url, consumer_key and consumer_secret are required"
      })
    }

    const count = await syncWooProducts(
      store._id,
      store_url,
      consumer_key,
      consumer_secret
    )

    return res.json({
      success: true,
      imported: count
    })

  } catch (error) {

    console.error("WooCommerce sync error:", error.message)

    return res.status(500).json({
      error: error.message
    })

  }
}



/*
--------------------------------
SYNC SHOPIFY
--------------------------------
*/
async function syncShopify(req, res) {
  try {

    const { shop_domain, access_token } = req.body

    if (!shop_domain || !access_token) {
      return res.status(400).json({
        error: "shop_domain and access_token are required"
      })
    }

    const store = req.store

    const count = await syncShopifyProducts(
      store._id,
      shop_domain,
      access_token
    )

    res.json({
      message: `${count} Shopify products synced successfully`
    })

  } catch (error) {

    console.error("Shopify sync error:", error.message)

    res.status(500).json({
      error: "Shopify sync failed",
      details: error.message
    })

  }
}

/*
--------------------------------
INTERNAL PRODUCT CATALOG
--------------------------------

Used by the AI Engine.

This endpoint is not exposed
through merchant authentication.

It is protected by the internal
AI Commerce platform key.
--------------------------------
*/

async function getInternalProducts(req, res) {

  try {

    /*
    --------------------------------
    INTERNAL AUTH
    --------------------------------
    */

    const platformKey =
      req.headers["x-platform-key"]

    if (
      !process.env.AI_COMMERCE_PLATFORM_KEY ||
      platformKey !==
        process.env.AI_COMMERCE_PLATFORM_KEY
    ) {

      return res.status(401).json({

        success: false,

        error:
          "Unauthorized platform request"

      })

    }


    /*
    --------------------------------
    STORE ID
    --------------------------------
    */

    const storeId =
      String(
        req.query.store_id || ""
      ).trim()


    if (!storeId) {

      return res.status(400).json({

        success: false,

        error:
          "store_id is required"

      })

    }


    /*
    --------------------------------
    VALIDATE STORE
    --------------------------------
    */

    const store =
      await Store.findById(
        storeId
      )


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

      })

    }


    /*
    --------------------------------
    LOAD PRODUCTS
    --------------------------------
    */

    const products =
      await Product.find({

        store_id:
          store._id

      })
      .sort({
        createdAt: -1
      })
      .lean()


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success: true,

      store_id:
        String(
          store._id
        ),

      products

    })

  } catch (error) {

    console.error(
      "Internal product catalog error:",
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Failed to fetch product catalog"

    })

  }

}


module.exports = {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  importProducts,
  syncWooCommerce,
  syncShopify,
  getInternalProducts
}
