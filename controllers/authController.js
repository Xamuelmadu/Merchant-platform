const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")

const User = require("../models/user")
const Store = require("../models/store")

const emailService =
  require("../services/emailService")


/*
================================
TOKEN HELPERS
================================
*/

function generateAccessToken(user) {

  return jwt.sign(

    {
      id:
        user._id,

      email:
        user.email,

      plan:
        user.plan || "free"
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "15m"
    }

  )

}


function generateRefreshToken(user) {

  return jwt.sign(

    {
      id:
        user._id
    },

    process.env.JWT_REFRESH_SECRET,

    {
      expiresIn: "30d"
    }

  )

}


/*
================================
PLATFORM AUTHENTICATION
================================

Used by trusted internal clients
such as the Shopify App.

This is NOT merchant authentication.

The Shopify App is already
authenticated with Shopify.

The platform key authenticates
the Shopify App to our backend.
================================
*/

function authenticatePlatformRequest(
  req
) {

  const platformKey =
    req.headers["x-platform-key"]

  const expectedKey =
    process.env.AI_COMMERCE_PLATFORM_KEY

  if (
    !expectedKey ||
    !platformKey ||
    platformKey !== expectedKey
  ) {

    return false

  }

  return true

}


/*
================================
CREATE SESSION
================================
*/

async function createSessionAndRespond(
  res,
  user
) {

  const accessToken =
    generateAccessToken(user)


  const refreshToken =
    generateRefreshToken(user)


  /*
  --------------------------------
  FIND USER STORE
  --------------------------------
  */

  const store =
    await Store.findOne({

      merchant_id:
        user._id

    })


  /*
  --------------------------------
  REFRESH COOKIE
  --------------------------------
  */

  res.cookie(

    "refresh_token",

    refreshToken,

    {

      httpOnly: true,

      secure: true,

      sameSite: "none",

      maxAge:
        30 *
        24 *
        60 *
        60 *
        1000

    }

  )


  /*
  --------------------------------
  RESPONSE
  --------------------------------
  */

  return res.json({

    success: true,

    token:
      accessToken,

    user,

    store_id:
      store
        ? store._id
        : null

  })

}


/*
================================
EMAIL HELPERS
================================
*/

function normalizeEmail(email) {

  return String(email || "")

    .trim()

    .toLowerCase()

}


/*
================================
VALIDATE EMAIL
================================
*/

function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    .test(email)

}


/*
================================
IDENTIFY SHOPIFY MERCHANT
================================

POST /api/auth/shopify/identify

Used by the Shopify App after
Shopify authentication.

The Shopify App sends:

- shop_id
- shop_domain
- shop_name
- shop_email
- currency

The backend then:

1. Authenticates the Shopify App
2. Finds an existing Shopify store
3. Finds the associated merchant
4. Creates a store for an existing
   AI Commerce merchant
5. Returns an identity requiring
   email verification for a new
   merchant
================================
*/

async function identifyShopifyUser(
  req,
  res
) {

  try {

    /*
    --------------------------------
    INTERNAL PLATFORM AUTH
    --------------------------------
    */

    if (
      !authenticatePlatformRequest(req)
    ) {

      return res.status(401).json({

        success: false,

        error:
          "Unauthorized platform request"

      })

    }


    /*
    --------------------------------
    INPUT
    --------------------------------
    */

    const {
      shop_id,
      shop_domain,
      shop_name,
      shop_email,
      currency
    } = req.body


    /*
    --------------------------------
    NORMALIZE SHOP DOMAIN
    --------------------------------
    */

    const normalizedDomain =
      String(
        shop_domain || ""
      )
        .trim()
        .toLowerCase()


    /*
    --------------------------------
    NORMALIZE EMAIL
    --------------------------------
    */

    const normalizedEmail =
      normalizeEmail(
        shop_email
      )


    /*
    --------------------------------
    NORMALIZE CURRENCY
    --------------------------------

    Shopify is authoritative for
    the store's currency.

    Examples:

    USD
    NGN
    GBP
    EUR
    CAD
    AUD
    --------------------------------
    */

    const normalizedCurrency =
      String(
        currency || "USD"
      )
        .trim()
        .toUpperCase()


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!shop_id) {

      return res.status(400).json({

        success: false,

        error:
          "shop_id is required"

      })

    }


    if (!normalizedDomain) {

      return res.status(400).json({

        success: false,

        error:
          "shop_domain is required"

      })

    }


    /*
    =================================
    FIND EXISTING SHOPIFY STORE
    =================================
    */

    let store =
      await Store.findOne({

        $or: [

          {
            "shopify.shop_id":
              String(shop_id)
          },

          {
            "shopify.shop_domain":
              normalizedDomain
          }

        ],

        platform:
          "shopify"

      })


    /*
    =================================
    EXISTING SHOPIFY STORE
    =================================
    */

    if (store) {

      /*
      --------------------------------
      FIND MERCHANT
      --------------------------------
      */

      const user =
        await User.findById(
          store.merchant_id
        )


      if (!user) {

        return res.status(409).json({

          success: false,

          error:
            "Shopify store exists but its merchant account could not be found"

        })

      }


      /*
      --------------------------------
      ENSURE SHOPIFY OBJECT EXISTS
      --------------------------------
      */

      store.shopify =
        store.shopify || {}


      /*
      --------------------------------
      UPDATE SHOPIFY IDENTITY
      --------------------------------
      */

      store.shopify.shop_id =
        String(shop_id)


      store.shopify.shop_domain =
        normalizedDomain


      store.shopify.connected =
        true


      /*
      --------------------------------
      UPDATE STORE NAME
      --------------------------------
      */

      if (shop_name) {

        store.store_name =
          shop_name

      }


      /*
      --------------------------------
      UPDATE CURRENCY
      --------------------------------
      */

      store.currency =
        normalizedCurrency


      /*
      --------------------------------
      CONNECTION STATE
      --------------------------------
      */

      store.platform =
        "shopify"

      store.platform_connected =
        true

      store.platform_connection_status =
        "connected"


      /*
      --------------------------------
      SAVE STORE
      --------------------------------
      */

      await store.save()


      /*
      --------------------------------
      CREATE SESSION
      --------------------------------
      */

      const accessToken =
        generateAccessToken(user)


      const refreshToken =
        generateRefreshToken(user)


      res.cookie(

        "refresh_token",

        refreshToken,

        {

          httpOnly: true,

          secure: true,

          sameSite: "none",

          maxAge:
            30 *
            24 *
            60 *
            60 *
            1000

        }

      )


      /*
      --------------------------------
      RETURN EXISTING IDENTITY
      --------------------------------
      */

      return res.json({

        success: true,

        authenticated: true,

        existing_user: true,

        requires_email_verification:
          false,

        token:
          accessToken,

        user,

        store_id:
          store._id

      })

    }


    /*
    =================================
    NEW SHOPIFY STORE
    =================================

    The store does not currently
    exist in AI Commerce.
    =================================
    */

    if (!normalizedEmail) {

      return res.status(400).json({

        success: false,

        error:
          "shop_email is required for a new Shopify identity"

      })

    }


    if (!isValidEmail(normalizedEmail)) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid Shopify merchant email"

      })

    }


    /*
    =================================
    FIND EXISTING AI COMMERCE USER
    =================================
    */

    let user =
      await User.findOne({

        email:
          normalizedEmail

      })


    /*
    =================================
    EXISTING AI COMMERCE USER
    =================================
    */

    if (user) {

      /*
      --------------------------------
      CHECK EXISTING SHOPIFY STORE
      --------------------------------
      */

      const existingShopifyStore =
        await Store.findOne({

          merchant_id:
            user._id,

          platform:
            "shopify"

        })


      if (existingShopifyStore) {

        return res.status(409).json({

          success: false,

          error:
            "This AI Commerce account already has a Shopify store"

        })

      }


      /*
      --------------------------------
      CREATE SHOPIFY STORE
      --------------------------------
      */

      store =
        await Store.create({

          merchant_id:
            user._id,

          store_name:
            shop_name ||
            normalizedDomain,

          industry:
            "ecommerce",

          currency:
            normalizedCurrency,

          platform:
            "shopify",

          platform_connected:
            true,

          platform_connection_status:
            "connected",

          shopify: {

            shop_id:
              String(shop_id),

            shop_domain:
              normalizedDomain,

            connected:
              true

          }

        })


      /*
      --------------------------------
      CREATE SESSION
      --------------------------------
      */

      return createSessionAndRespond(

        res,

        user

      )

    }


    /*
    =================================
    NEW AI COMMERCE MERCHANT
    =================================

    We do NOT create the account yet.

    The merchant must verify ownership
    of the Shopify email through the
    AI Commerce email OTP flow.

    This keeps AI Commerce as the
    owner of its authentication system.
    =================================
    */

    return res.json({

      success: true,

      authenticated: false,

      existing_user: false,

      requires_email_verification:
        true,

      requires_account_creation:
        true,

      shopify_identity: {

        shop_id:
          String(shop_id),

        shop_domain:
          normalizedDomain,

        shop_name:
          shop_name || null,

        email:
          normalizedEmail,

        currency:
          normalizedCurrency

      }

    })

  } catch (error) {

    console.error(
      "Shopify identity error:",
      error
    )


    return res.status(500).json({

      success: false,

      error:
        "Failed to identify Shopify merchant",

      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message

    })

  }

}


/*
================================
SEND OTP
================================
*/

async function sendOtp(
  req,
  res
) {

  try {

    const email =
      normalizeEmail(
        req.body.email
      )


    if (!email) {

      return res.status(400).json({

        success: false,

        error:
          "Email is required"

      })

    }


    if (!isValidEmail(email)) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid email"

      })

    }


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

    const user =
      await User.findOne({
        email
      })


    /*
    --------------------------------
    GENERATE OTP
    --------------------------------
    */

    const otp =
      String(
        Math.floor(
          100000 +
          Math.random() *
          900000
        )
      )


    const otpHash =
      crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex")


    /*
    --------------------------------
    OTP STORAGE
    --------------------------------
    */

    if (user) {

      user.otp_hash =
        otpHash

      user.otp_expires_at =
        new Date(
          Date.now() +
          10 *
          60 *
          1000
        )

      await user.save()

    }


    /*
    --------------------------------
    SEND EMAIL
    --------------------------------
    */

    await emailService.sendOtpEmail({
  email,
  otp,
  purpose: req.body.purpose
})


    return res.json({

      success: true,

      message:
        "Verification code sent"

    })

  } catch (error) {

    console.error(
      "Send OTP error:",
      error
    )

    return res.status(500).json({

      success: false,

      error:
        "Failed to send verification code"

    })

  }

}


/*
================================
VERIFY OTP
================================
*/

async function verifyOtp(
  req,
  res
) {

  try {

    const email =
      normalizeEmail(
        req.body.email
      )

    const otp =
      String(
        req.body.otp || ""
      )
        .trim()


    if (!email || !otp) {

      return res.status(400).json({

        success: false,

        error:
          "Email and OTP are required"

      })

    }


    const user =
      await User.findOne({
        email
      })


    if (!user) {

      return res.status(404).json({

        success: false,

        error:
          "Account not found"

      })

    }


    const otpHash =
      crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex")


    if (
      !user.otp_hash ||
      user.otp_hash !== otpHash
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid verification code"

      })

    }


    if (
      !user.otp_expires_at ||
      user.otp_expires_at <
        new Date()
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Verification code has expired"

      })

    }


    /*
    --------------------------------
    VERIFY USER
    --------------------------------
    */

    user.email_verified =
      true

    user.email_verified_at =
      new Date()

    user.otp_hash =
      undefined

    user.otp_expires_at =
      undefined


    await user.save()


    /*
    --------------------------------
    CREATE SESSION
    --------------------------------
    */

    return createSessionAndRespond(

      res,

      user

    )

  } catch (error) {

    console.error(
      "Verify OTP error:",
      error
    )

    return res.status(500).json({

      success: false,

      error:
        "Verification failed"

    })

  }

}


/*
================================
REFRESH TOKEN
================================
*/

async function refreshToken(
  req,
  res
) {

  try {

    const token =
      req.cookies?.refresh_token


    if (!token) {

      return res.status(401).json({

        success: false,

        error:
          "Refresh token required"

      })

    }


    const decoded =
      jwt.verify(

        token,

        process.env.JWT_REFRESH_SECRET

      )


    const user =
      await User.findById(
        decoded.id
      )


    if (!user) {

      return res.status(401).json({

        success: false,

        error:
          "User not found"

      })

    }


    const accessToken =
      generateAccessToken(user)


    return res.json({

      success: true,

      token:
        accessToken

    })

  } catch (error) {

    return res.status(401).json({

      success: false,

      error:
        "Invalid refresh token"

    })

  }

}


/*
================================
GET SESSION
================================
*/

async function getSession(
  req,
  res
) {

  try {

    const token =
      req.headers.authorization
        ?.replace(
          "Bearer ",
          ""
        )


    if (!token) {

      return res.status(401).json({

        success: false,

        error:
          "Authentication required"

      })

    }


    const decoded =
      jwt.verify(

        token,

        process.env.JWT_SECRET

      )


    const user =
      await User.findById(
        decoded.id
      )


    if (!user) {

      return res.status(401).json({

        success: false,

        error:
          "User not found"

      })

    }


    const store =
      await Store.findOne({

        merchant_id:
          user._id

      })


    return res.json({

      success: true,

      user,

      store_id:
        store
          ? store._id
          : null

    })

  } catch (error) {

    return res.status(401).json({

      success: false,

      error:
        "Invalid session"

    })

  }

}


/*
================================
LOGOUT
================================
*/

async function logout(
  req,
  res
) {

  res.clearCookie(

    "refresh_token",

    {

      httpOnly: true,

      secure: true,

      sameSite: "none"

    }

  )


  return res.json({

    success: true,

    message:
      "Logged out"

  })

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  sendOtp,

  verifyOtp,

  identifyShopifyUser,

  refreshToken,

  getSession,

  logout,

  generateAccessToken,

  generateRefreshToken

}