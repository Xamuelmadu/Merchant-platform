const express = require("express")
const router = express.Router()

const auth = require("../middleware/authMiddleware")
const storeController = require("../controllers/storeController")

/*
--------------------------------
STORE ONBOARDING
--------------------------------
*/

router.post(
  "/create",
  auth,
  storeController.createStore
)

router.post(
  "/connect-whatsapp",
  auth,
  storeController.connectWhatsApp
)

router.post(
  "/payments",
  auth,
  storeController.updatePayments
)

router.post(
  "/finish",
  auth,
  storeController.finishOnboarding
)


/*
--------------------------------
GET CURRENT STORE
--------------------------------
(Useful for dashboard + onboarding checks)
*/

router.get(
  "/me",
  auth,
  storeController.getStore
)


module.exports = router