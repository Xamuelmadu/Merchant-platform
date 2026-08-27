const express = require("express")

const router =
  express.Router()

const webhookController =
  require("../controllers/webhookController")


/*
--------------------------------
STRIPE WEBHOOK
--------------------------------
*/

router.post(
  "/stripe",
  webhookController.handleStripeWebhook
)


/*
--------------------------------
PAYSTACK WEBHOOK
--------------------------------
*/

router.post(
  "/paystack",
  webhookController.handlePaystackWebhook
)


/*
--------------------------------
SHOPIFY WEBHOOK
--------------------------------

Shopify requests are verified using
the raw request body in the controller.
--------------------------------
*/

router.post(
  "/shopify",
  webhookController.handleShopifyWebhook
)


module.exports = router