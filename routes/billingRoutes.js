const express = require("express")
const router = express.Router()

const auth = require("../middleware/authMiddleware")
const loadStore = require("../middleware/loadStore")

const billingController = require("../controllers/billingController")

/*
--------------------------------
BILLING OVERVIEW
--------------------------------
*/

router.get(
  "/",
  auth,
  loadStore,
  billingController.getBillingInfo
)


/*
--------------------------------
INVOICES
--------------------------------
*/

router.get(
  "/invoice",
  auth,
  loadStore,
  billingController.getMonthlyInvoice
)

router.post(
  "/pay-invoice",
  auth,
  loadStore,
  billingController.payInvoice
)

router.get(
  "/history",
  auth,
  loadStore,
  billingController.getBillingHistory
)


/*
--------------------------------
SUBSCRIPTIONS
--------------------------------
*/

router.post(
  "/upgrade",
  auth,
  loadStore,
  billingController.upgradePlan
)

router.post(
  "/cancel",
  auth,
  loadStore,
  billingController.cancelSubscription
)


/*
--------------------------------
PLATFORM FEES
--------------------------------
*/

router.post(
  "/charge-fees",
  auth,
  loadStore,
  billingController.chargePlatformFees
)


module.exports = router