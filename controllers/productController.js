const Store = require("../models/store")
const Product = require("../models/product")

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
      reserved_stock: 0,     //  inventory system ready
      sold: 0,               //  analytics ready
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

    const products = await Product
      .find({ store_id: store._id })
      .sort({ createdAt: -1 })

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
      message: "Product updated",
      product
    })

  } catch (error) {

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
      message: "Product deleted"
    })

  } catch (error) {

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

    const count = await syncWooProducts(store._id)

    res.json({
      success: true,
      imported: count
    })

  } catch (error) {

    console.error("Woo sync error:", error)

    res.status(500).json({
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



module.exports = {
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  importProducts,
  syncWooCommerce,
  syncShopify
}