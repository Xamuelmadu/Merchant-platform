const express = require("express")

const router = express.Router()

const auth = require("../middleware/auth")
const loadStore = require("../middleware/loadStore")

const integrationController =
  require("../controllers/integrationController")


/*
--------------------------------
PAYMENT SETTINGS
--------------------------------
*/

router.get(
  "/payments",
  auth,
  loadStore,
  integrationController.getPayments
)

router.post(
  "/payments/update",
  auth,
  loadStore,
  integrationController.updatePayments
)

/*
--------------------------------
RESOLVE SHOPIFY STORE
--------------------------------
GET /api/integrations/shopify/store
--------------------------------
*/

router.get(
  "/shopify/store",
  integrationController.getShopifyStore
)

/*
--------------------------------
SHOPIFY CONNECTION
--------------------------------
*/

router.post(
  "/shopify/connect",
  integrationController.connectShopify
)

/*
--------------------------------
SHOPIFY PRODUCT SYNC
--------------------------------
*/

router.post(
  "/shopify/products/sync",
  integrationController.syncShopifyProductsController
)

module.exports = router