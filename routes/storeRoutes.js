const express = require("express")
const router = express.Router()

const auth = require("../middleware/auth")
const loadStore = require("../middleware/loadStore")

const shopifyIntegration =
  require("../middleware/shopifyIntegration")

const storeController =
  require("../controllers/storeController")


/*
--------------------------------
STORE CREATION
--------------------------------
Used for onboarding + multi-store
--------------------------------
*/

router.post(
  "/create",
  auth,
  storeController.createStore
)


/*
--------------------------------
GET ALL STORES
--------------------------------
Multi-store support
--------------------------------
*/

router.get(
  "/",
  auth,
  storeController.getStores
)


/*
--------------------------------
SHOPIFY CONNECTION
--------------------------------
Used by the Shopify app after
successful Shopify authentication.

This route does not use the normal
JWT auth middleware because the
request originates from the
authenticated Shopify app.
--------------------------------
*/

router.post(
  "/shopify/connect",
  shopifyIntegration,
  storeController.connectShopify
)


/*
--------------------------------
GET SINGLE STORE
--------------------------------
*/

router.get(
  "/:id",
  auth,
  storeController.getStore
)


/*
--------------------------------
UPDATE STORE
--------------------------------
*/

router.patch(
  "/:id",
  auth,
  loadStore,
  storeController.updateStore
)


/*
--------------------------------
DELETE STORE
--------------------------------
*/

router.delete(
  "/:id",
  auth,
  loadStore,
  storeController.deleteStore
)


/*
--------------------------------
STORE PAYMENT SETTINGS
--------------------------------
*/

router.post(
  "/payments",
  auth,
  storeController.savePaymentSettings
)


module.exports = router