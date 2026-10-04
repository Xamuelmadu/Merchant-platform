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
  "/paystack-webhook",
  paymentController.paystackWebhook
)


/*
================================
FLUTTERWAVE WEBHOOK
================================
*/

router.post(
  "/flutterwave-webhook",
  paymentController.flutterwaveWebhook
)


/*
================================
FLUTTERWAVE PAYMENT VERIFICATION
================================
*/

router.get(
  "/flutterwave/verify",
  paymentController.verifyFlutterwavePayment
)


module.exports = router