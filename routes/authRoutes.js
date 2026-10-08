const express = require("express")

const router = express.Router()

const auth =
  require("../middleware/auth")

const {
  sendOtp,
  verifyOtp,

  /*
  --------------------------------
  SHOPIFY IDENTITY
  --------------------------------
  */

  identifyShopifyUser,

  createShopifyConnectionIntent,

  /*
  --------------------------------
  TOKEN MANAGEMENT
  --------------------------------
  */

  refreshToken,
  getSession,
  logout

} = require("../controllers/authController")


/*
================================
EMAIL OTP AUTH
================================
*/

router.post(
  "/send-otp",
  sendOtp
)


router.post(
  "/verify-otp",
  verifyOtp
)


/*
================================
SHOPIFY CONNECTION INTENT
================================

Called by the authenticated
Guava dashboard before sending
the merchant to Shopify.

The endpoint creates a short-lived
signed intent identifying the
current Guava User.

The browser never supplies
merchant_id.
================================
*/

router.post(
  "/shopify/connection-intent",
  auth,
  createShopifyConnectionIntent
)


/*
================================
SHOPIFY IDENTITY
================================

Called by the authenticated
Shopify App.

The platform key proves that the
request came from our Shopify App.

A connection intent, when present,
proves that the connection was
initiated by an already-authenticated
Guava merchant.
================================
*/

router.post(
  "/shopify/identify",
  identifyShopifyUser
)


/*
================================
TOKEN MANAGEMENT
================================
*/

router.get(
  "/refresh",
  refreshToken
)


router.get(
  "/session",
  getSession
)


router.post(
  "/logout",
  logout
)


/*
================================
EXPORT
================================
*/

module.exports = router