const express = require("express")

const router = express.Router()

const {
  sendOtp,
  verifyOtp,
  refreshToken,
  getSession,
  logout,

  /*
  --------------------------------
  SHOPIFY IDENTITY
  --------------------------------
  */

  identifyShopifyUser,
  linkShopifyStore

} = require("../controllers/authController")


/*
================================
EMAIL OTP AUTH
================================

PRIMARY AI COMMERCE AUTHENTICATION

SIGN UP / SIGN IN

1. User enters email
2. /send-otp sends verification code
3. User enters OTP
4. /verify-otp creates or authenticates
   the user's account
5. Session is created
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
SHOPIFY IDENTITY
================================

The Shopify App is already
authenticated by Shopify.

These endpoints allow the Shopify
App to establish the corresponding
AI Commerce identity.

Shopify authentication proves:

"This request came from the
authenticated Shopify App."

AI Commerce authentication proves:

"This Shopify merchant belongs to
this AI Commerce User."
================================
*/


/*
--------------------------------
IDENTIFY SHOPIFY MERCHANT
--------------------------------

Used by the Shopify App after
Shopify authentication.

The endpoint:

1. Finds the Shopify store
2. Finds its merchant
3. Creates the AI Commerce
   identity if necessary
4. Returns the merchant/store
   relationship
--------------------------------
*/

router.post(
  "/shopify/identify",
  identifyShopifyUser
)


/*
--------------------------------
LINK SHOPIFY STORE
--------------------------------

Used when a Shopify store needs
to be associated with an existing
AI Commerce account.

Example:

Existing AI Commerce user:

user@example.com

installs Shopify App

↓

Shopify identity verified

↓

Store gets linked to:

User._id
--------------------------------
*/

router.post(
  "/shopify/link",
  linkShopifyStore
)


/*
================================
TOKEN MANAGEMENT
================================
*/


/*
--------------------------------
REFRESH ACCESS TOKEN
--------------------------------

The refresh token is stored in
an httpOnly cookie.

Returns a new short-lived
access token.
*/

router.get(
  "/refresh",
  refreshToken
)


/*
--------------------------------
CURRENT SESSION
--------------------------------

Used by the webapp and Shopify
App to restore the authenticated
AI Commerce merchant after:

- Page refresh
- Browser reopen
- Dashboard navigation
- Access token expiration

The refresh_token cookie identifies
the AI Commerce User.
*/

router.get(
  "/session",
  getSession
)


/*
--------------------------------
LOGOUT
--------------------------------

Clears the AI Commerce refresh
session.
*/

router.post(
  "/logout",
  logout
)


module.exports = router