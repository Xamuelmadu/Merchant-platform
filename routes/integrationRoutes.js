const express = require("express")

const router = express.Router()

const auth =
  require("../middleware/auth")

const loadStore =
  require("../middleware/loadStore")

const integrationController =
  require("../controllers/integrationController")

const woocommercePluginAuth =
  require(
    "../middleware/woocommercePluginAuth"
  )

/*
================================
PAYMENT SETTINGS
================================
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
================================
SHOPIFY STORE RESOLUTION
================================
*/

router.get(
  "/shopify/store",
  integrationController.getShopifyStore
)



/*
================================
SHOPIFY CONNECTION
================================
*/

router.post(
  "/shopify/connect",
  integrationController.connectShopify
)



/*
================================
SHOPIFY PRODUCT SYNC
================================
*/

router.post(
  "/shopify/products/sync",
  integrationController.syncShopifyProductsController
)



/*
================================
WOOCOMMERCE CONNECTION
================================
*/

router.post(
  "/woocommerce/connect",
  auth,
  loadStore,
  integrationController.connectWooCommerce
)



/*
================================
WOOCOMMERCE PRODUCT SYNC
================================
*/

router.post(
  "/woocommerce/products/sync",
  auth,
  loadStore,
  integrationController.syncWooCommerceProductsController
)



/*
================================
WOOCOMMERCE PLUGIN TOKEN
================================

Authenticated merchant requests a
short-lived installation token.
================================
*/

router.post(
  "/woocommerce/plugin/token",
  auth,
  integrationController.generateWooCommercePluginToken
)



/*
================================
WOOCOMMERCE PLUGIN CONNECT
================================

Called by the WooCommerce plugin
to connect the store to the merchant.
================================
*/

router.post(
  "/woocommerce/plugin/connect",
  integrationController.connectWooCommercePlugin
)

/*
================================
WOOCOMMERCE CUSTOMER CONVERSATION TOKEN
================================

Called by the WooCommerce plugin
using its persistent plugin credential.

The returned token is short-lived
and is used for customer chat.
================================
*/

router.post(
  "/woocommerce/plugin/conversation-token",
  woocommercePluginAuth,
  integrationController.generateWooCommerceConversationToken
)


module.exports = router
