const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const loadStore = require("../middleware/loadStore");
const integrationController = require("../controllers/integrationController");
const woocommercePluginAuth = require("../middleware/woocommercePluginAuth");

/*
|--------------------------------------------------------------------------
| PAYMENT SETTINGS
|--------------------------------------------------------------------------
*/

router.get(
  "/payments",
  auth,
  loadStore,
  integrationController.getPayments
);

router.post(
  "/payments/update",
  auth,
  loadStore,
  integrationController.updatePayments
);

/*
|--------------------------------------------------------------------------
| SHOPIFY STORE RESOLUTION
|--------------------------------------------------------------------------
*/

router.get(
  "/shopify/store",
  integrationController.getShopifyStore
);

/*
|--------------------------------------------------------------------------
| SHOPIFY CUSTOMER CONVERSATION TOKEN
|--------------------------------------------------------------------------
|
| Called by the Shopify app server using the internal platform key.
| The controller resolves the connected store from its Shopify domain
| and generates a short-lived customer conversation token.
|
*/

router.post(
  "/shopify/conversation-token",
  integrationController.generateShopifyConversationToken
);

/*
|--------------------------------------------------------------------------
| SHOPIFY CONNECTION
|--------------------------------------------------------------------------
*/

router.post(
  "/shopify/connect",
  integrationController.connectShopify
);

/*
|--------------------------------------------------------------------------
| SHOPIFY PRODUCT SYNC
|--------------------------------------------------------------------------
*/

router.post(
  "/shopify/products/sync",
  integrationController.syncShopifyProductsController
);

/*
|--------------------------------------------------------------------------
| WOOCOMMERCE CONNECTION
|--------------------------------------------------------------------------
*/

router.post(
  "/woocommerce/connect",
  auth,
  loadStore,
  integrationController.connectWooCommerce
);

/*
|--------------------------------------------------------------------------
| WOOCOMMERCE PRODUCT SYNC
|--------------------------------------------------------------------------
*/

router.post(
  "/woocommerce/products/sync",
  auth,
  loadStore,
  integrationController.syncWooCommerceProductsController
);

/*
|--------------------------------------------------------------------------
| WOOCOMMERCE PLUGIN TOKEN
|--------------------------------------------------------------------------
|
| Authenticated merchant requests a short-lived installation token.
|
*/

router.post(
  "/woocommerce/plugin/token",
  auth,
  integrationController.generateWooCommercePluginToken
);

/*
|--------------------------------------------------------------------------
| WOOCOMMERCE PLUGIN CONNECT
|--------------------------------------------------------------------------
|
| Called by the WooCommerce plugin to connect a store.
|
*/

router.post(
  "/woocommerce/plugin/connect",
  integrationController.connectWooCommercePlugin
);

/*
|--------------------------------------------------------------------------
| WOOCOMMERCE CUSTOMER CONVERSATION TOKEN
|--------------------------------------------------------------------------
|
| Authenticated through the persistent WooCommerce plugin credential.
| Returns a short-lived token for customer conversations.
|
*/

router.post(
  "/woocommerce/plugin/conversation-token",
  woocommercePluginAuth,
  integrationController.generateWooCommerceConversationToken
);

module.exports = router;