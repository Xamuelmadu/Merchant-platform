
const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  // Email OTP authentication
  sendOtp,
  verifyOtp,

  // Shopify identity and connection
  identifyShopifyUser,
  createShopifyConnectionIntent,

  // Shopify login handoff
  createShopifyLoginHandoff,
  redeemShopifyLoginHandoff,

  // Token management
  refreshToken,
  getSession,
  logout,
} = require("../controllers/authController");

/*
================================
EMAIL OTP AUTHENTICATION
================================
*/

// Send an email verification code.
router.post(
  "/send-otp",
  sendOtp
);

// Verify an email code and establish a session.
router.post(
  "/verify-otp",
  verifyOtp
);

/*
================================
SHOPIFY CONNECTION INTENT
================================

Called by the authenticated Guava dashboard
before redirecting the merchant to Shopify.

The signed intent identifies the authenticated
Guava user without trusting a browser-supplied
merchant_id.
================================
*/

router.post(
  "/shopify/connection-intent",
  auth,
  createShopifyConnectionIntent
);

/*
================================
SHOPIFY MERCHANT IDENTITY
================================

Called by the Shopify app.

The controller validates the platform key
and handles Shopify merchant identification
and store association.
================================
*/

router.post(
  "/shopify/identify",
  identifyShopifyUser
);

/*
================================
CREATE SHOPIFY LOGIN HANDOFF
================================

POST /api/auth/shopify/handoff

Called by the trusted Shopify app after
merchant identity has been established.

Validates the merchant, store ownership,
JWT, and dashboard callback destination.

Returns a short-lived, one-time code.
================================
*/

router.post(
  "/shopify/handoff",
  createShopifyLoginHandoff
);

/*
================================
REDEEM SHOPIFY LOGIN HANDOFF
================================

POST /api/auth/shopify/handoff/redeem

Called by the Guava dashboard callback.

Redeems the one-time code and establishes
the existing dashboard session.
================================
*/

router.post(
  "/shopify/handoff/redeem",
  redeemShopifyLoginHandoff
);

/*
================================
TOKEN MANAGEMENT
================================
*/

// Refresh the access token using the
// existing refresh-token cookie.
router.get(
  "/refresh",
  refreshToken
);

// Retrieve the authenticated user session.
router.get(
  "/session",
  getSession
);

// Clear the existing refresh-token cookie.
router.post(
  "/logout",
  logout
);

/*
================================
EXPORT ROUTER
================================
*/

module.exports = router;
