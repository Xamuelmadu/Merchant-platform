const express = require("express")
const router = express.Router()
const multer = require("multer")

const auth = require("../middleware/authMiddleware")
const loadStore = require("../middleware/loadStore")

const productController = require("../controllers/productController")



/*
--------------------------------
FILE UPLOAD CONFIGURATION
--------------------------------
*/

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {

    if (
      file.mimetype === "text/csv" ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true)
    } else {
      cb(new Error("Only CSV files are allowed"))
    }

  }
})



/*
--------------------------------
PRODUCT MANAGEMENT
--------------------------------
*/

/*
Add product manually
*/
router.post(
  "/add",
  auth,
  loadStore,
  productController.addProduct
)

/*
Get all products
*/
router.get(
  "/",
  auth,
  loadStore,
  productController.getProducts
)

/*
Get single product
*/
router.get(
  "/:id",
  auth,
  loadStore,
  productController.getProductById
)

/*
Update product
*/
router.patch(
  "/:id",
  auth,
  loadStore,
  productController.updateProduct
)

/*
Delete product
*/
router.delete(
  "/:id",
  auth,
  loadStore,
  productController.deleteProduct
)



/*
--------------------------------
PRODUCT IMPORT
--------------------------------
*/

/*
Import products from CSV
*/
router.post(
  "/import-csv",
  auth,
  loadStore,
  upload.single("file"),
  productController.importProducts
)



/*
--------------------------------
STORE INTEGRATIONS
--------------------------------
*/

/*
Sync WooCommerce products
*/
router.post(
  "/sync-woocommerce",
  auth,
  loadStore,
  productController.syncWooCommerce
)

/*
Sync Shopify products
*/
router.post(
  "/sync-shopify",
  auth,
  loadStore,
  productController.syncShopify
)



module.exports = router