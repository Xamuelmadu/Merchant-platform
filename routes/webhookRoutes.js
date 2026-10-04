const express = require("express")

const router =
  express.Router()

const {
  flutterwaveWebhook
} = require("../controllers/webhookController")



/*
================================
FLUTTERWAVE WEBHOOK
================================

Handles platform subscription
payments through Flutterwave.

Merchant customer checkout does
NOT use this webhook.

Shopify customers use Shopify
checkout.

WooCommerce customers use
WooCommerce checkout.

Paystack has been removed.
================================
*/

router.post(
  "/flutterwave-webhook",
  flutterwaveWebhook
)



module.exports = router