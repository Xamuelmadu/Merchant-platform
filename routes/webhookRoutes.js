const express = require("express")
const router = express.Router()

const webhookController = require("../controllers/webhookController")

/*
Stripe Webhook
*/
router.post("/stripe", webhookController.handleStripeWebhook)

/*
Paystack Webhook
*/
router.post("/paystack", webhookController.handlePaystackWebhook)

module.exports = router