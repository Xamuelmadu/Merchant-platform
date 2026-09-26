const express = require("express")

const router =
  express.Router()

const webhookController =
  require("../controllers/webhookController")


/*
================================
STRIPE WEBHOOK
================================
*/

router.post(
  "/stripe",
  webhookController.handleStripeWebhook
)


/*
================================
PAYSTACK WEBHOOK
================================
*/

router.post(
  "/paystack",
  webhookController.handlePaystackWebhook
)


/*
================================
SHOPIFY WEBHOOK
================================
*/

router.post(
  "/shopify",
  webhookController.handleShopifyWebhook
)


/*
================================
WOOCOMMERCE WEBHOOK
================================
*/

router.post(
  "/woocommerce",
  webhookController.handleWooCommerceWebhook
)


module.exports = router