const express = require("express")

const router =
  express.Router()

const paymentController =
  require("../controllers/paymentController")



/*
================================
PAYSTACK WEBHOOK
================================
*/

router.post(
  "/paystack/webhook",
  paymentController.paystackWebhook
)


/*
================================
FLUTTERWAVE WEBHOOK
================================
*/

router.post(
  "/flutterwave/webhook",
  paymentController.flutterwaveWebhook
)


module.exports = router

