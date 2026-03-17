const express = require("express")
const router = express.Router()

const auth = require("../middleware/authMiddleware")
const loadStore = require("../middleware/loadStore")

const integrationController = require("../controllers/integrationController")

/*
GET PAYMENT SETTINGS
*/
router.get(
  "/payments",
  auth,
  loadStore,
  integrationController.getPayments
)

/*
UPDATE PAYMENT SETTINGS
*/
router.post(
  "/payments/update",
  auth,
  loadStore,
  integrationController.updatePayments
)

module.exports = router