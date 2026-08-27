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
SHOPIFY CONNECTION
--------------------------------
*/

router.post(
  "/shopify/connect",
  integrationController.connectShopify
)


module.exports = router