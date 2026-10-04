const express = require("express")

const router =
  express.Router()


/*
================================
PAYMENT ROUTES
================================

Customer checkout is handled by
the merchant's native commerce
platform.

Shopify:
Native Shopify checkout.

WooCommerce:
Native WooCommerce checkout.

Platform subscriptions:
Flutterwave subscription checkout
and webhook handling are handled
through webhookRoutes.js.

There is no Paystack checkout and
no customer Flutterwave verification
endpoint.
================================
*/


module.exports = router