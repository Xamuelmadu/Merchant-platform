const User = require("../models/user")

const Store = require("../models/store")

const Otp = require("../models/otp")


const jwt = require("jsonwebtoken")

const crypto = require("crypto")


const {
  sendOtpEmail
} = require("../services/emailOtpService")


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
NORMALIZE EMAIL
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
SEND EMAIL OTP
================================

Used for:

1. New account verification
2. Existing user sign-in verification

The backend determines whether this
is signup or signin based on whether
the user already exists.
================================
*/


async function sendOtp(req, res) {

  try {

    const email =
      normalizeEmail(
        req.body.email
      )


    /*
    --------------------------------
    VALIDATE EMAIL
    --------------------------------
    */

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
          "Invalid email address"

      })

    }


    /*
    --------------------------------
    CHECK ACCOUNT
    --------------------------------
    */

    const existingUser =
      await User.findOne({

        email

      })


    /*
    --------------------------------
    DETERMINE OTP PURPOSE
    --------------------------------
    */

    const purpose =
      existingUser
        ? "signin"
        : "signup"


    /*
    --------------------------------
    GENERATE OTP
    --------------------------------
    */

    const otp =
      crypto

        .randomInt(
          100000,
          1000000
        )

        .toString()


    /*
    --------------------------------
    REMOVE OLD OTP
    --------------------------------
    */

    await Otp.deleteMany({

      email

    })


    /*
    --------------------------------
    CREATE OTP
    --------------------------------
    */

    await Otp.create({

      email,

      otp,

      purpose,

      expires_at:

        new Date(

          Date.now() +

          10 *

          60 *

          1000

        )

    })


    /*
    --------------------------------
    SEND EMAIL
    --------------------------------
    */

    await sendOtpEmail({

      email,

      otp,

      purpose

    })


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success: true,

      message:
        "OTP sent to your email",

      purpose

    })

  } catch (error) {

    console.error(

      "Send email OTP error:",

      error

    )


    return res.status(500).json({

      success: false,

      error:
        "Failed to send OTP"

    })

  }

}


/*
================================
VERIFY EMAIL OTP
================================

Handles:

1. New account creation
2. Existing user sign-in

The user only receives a session
after successful OTP verification.
================================
*/


async function verifyOtp(req, res) {

  try {

    const email =
      normalizeEmail(
        req.body.email
      )


    const otp =
      String(
        req.body.otp || ""
      ).trim()


    /*
    --------------------------------
    VALIDATE EMAIL
    --------------------------------
    */

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
          "Invalid email address"

      })

    }


    /*
    --------------------------------
    VALIDATE OTP
    --------------------------------
    */

    if (!otp) {

      return res.status(400).json({

        success: false,

        error:
          "OTP is required"

      })

    }


    if (!/^\d{6}$/.test(otp)) {

      return res.status(400).json({

        success: false,

        error:
          "OTP must be a 6-digit code"

      })

    }


    /*
    --------------------------------
    FIND OTP
    --------------------------------
    */

    const record =
      await Otp.findOne({

        email

      })


    if (!record) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid or expired OTP"

      })

    }


    /*
    --------------------------------
    CHECK OTP
    --------------------------------
    */

    if (record.otp !== otp) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid OTP"

      })

    }


    /*
    --------------------------------
    CHECK EXPIRATION
    --------------------------------
    */

    if (
      record.expires_at <
      new Date()
    ) {

      await Otp.deleteMany({

        email

      })


      return res.status(400).json({

        success: false,

        error:
          "OTP expired"

      })

    }


    /*
    --------------------------------
    FIND EXISTING USER
    --------------------------------
    */

    let user =
      await User.findOne({

        email

      })


    /*
    --------------------------------
    CREATE NEW USER
    --------------------------------

    A user is created only after
    successful OTP verification.
    --------------------------------
    */

    if (!user) {

      user =
        await User.create({

          email,

          name:
            email.split("@")[0],

          password:
            null,

          plan:
            "free"

        })

    }


    /*
    --------------------------------
    DELETE USED OTP
    --------------------------------
    */

    await Otp.deleteMany({

      email

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

  } catch (error) {

    console.error(

      "Verify OTP error:",

      error

    )


    return res.status(500).json({

      success: false,

      error:
        "OTP verification failed"

    })

  }

}


/*
================================
SHOPIFY IDENTITY
================================

POST /api/auth/shopify/identify

The Shopify App calls this after
Shopify authentication.

The purpose is to answer:

"Which AI Commerce User owns this
Shopify store?"

There are three possible states:

1. Existing Shopify store
   → existing merchant returned

2. Existing AI Commerce user but
   Shopify store is not connected
   → store is linked

3. Completely new merchant
   → account creation is returned
      as requiring email verification

The Shopify App does NOT become the
owner of the identity.

AI Commerce owns the User record.
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
      shop_email
    } = req.body


    const normalizedDomain =
      String(
        shop_domain || ""
      )
        .trim()
        .toLowerCase()


    const normalizedEmail =
      normalizeEmail(
        shop_email
      )


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
    --------------------------------
    FIND EXISTING SHOPIFY STORE
    --------------------------------
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
    --------------------------------
    EXISTING STORE
    --------------------------------
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
      UPDATE SHOPIFY IDENTITY
      --------------------------------
      */

      let changed = false


      if (
        store.shopify?.shop_id !==
        String(shop_id)
      ) {

        store.shopify.shop_id =
          String(shop_id)

        changed = true

      }


      if (
        store.shopify?.shop_domain !==
        normalizedDomain
      ) {

        store.shopify.shop_domain =
          normalizedDomain

        changed = true

      }


      if (
        !store.platform_connected
      ) {

        store.platform_connected =
          true

        changed = true

      }


      if (
        store.platform_connection_status !==
        "connected"
      ) {

        store.platform_connection_status =
          "connected"

        changed = true

      }


      if (
        !store.shopify.connected
      ) {

        store.shopify.connected =
          true

        changed = true

      }


      if (changed) {

        await store.save()

      }


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
    --------------------------------
    SHOPIFY STORE DOES NOT EXIST
    --------------------------------
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
    --------------------------------
    FIND EXISTING AI COMMERCE USER
    --------------------------------
    */

    let user =
      await User.findOne({

        email:
          normalizedEmail

      })


    /*
    --------------------------------
    EXISTING USER
    --------------------------------

    The Shopify store can be linked
    immediately because the merchant
    already owns an AI Commerce account.

    --------------------------------
    */

    if (user) {

      store =
        await Store.findOne({

          merchant_id:
            user._id,

          platform:
            "shopify"

        })


      /*
      --------------------------------
      USER ALREADY HAS ANOTHER
      SHOPIFY STORE
      --------------------------------
      */

      if (store) {

        return res.status(409).json({

          success: false,

          error:
            "This AI Commerce account already has a Shopify store"

        })

      }


      /*
      --------------------------------
      CREATE STORE
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
            "USD",

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

    IMPORTANT:

    We do NOT create the account yet.

    The merchant must verify ownership
    of the Shopify email through our
    email OTP flow.

    This preserves AI Commerce as the
    owner of its own identity system.
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
          normalizedEmail

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
LINK SHOPIFY STORE
================================

POST /api/auth/shopify/link

Called after a merchant has an
AI Commerce identity.

This endpoint connects the Shopify
store to the authenticated AI Commerce
User.

The Shopify App supplies the merchant
email and Shopify identity.
================================
*/


async function linkShopifyStore(
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
      shop_email
    } = req.body


    const normalizedDomain =
      String(
        shop_domain || ""
      )
        .trim()
        .toLowerCase()


    const normalizedEmail =
      normalizeEmail(
        shop_email
      )


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


    if (!normalizedEmail) {

      return res.status(400).json({

        success: false,

        error:
          "shop_email is required"

      })

    }


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

    const user =
      await User.findOne({

        email:
          normalizedEmail

      })


    if (!user) {

      return res.status(404).json({

        success: false,

        error:
          "AI Commerce user not found"

      })

    }


    /*
    --------------------------------
    CHECK SHOPIFY STORE
    --------------------------------
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
    --------------------------------
    STORE BELONGS TO ANOTHER USER
    --------------------------------
    */

    if (
      store &&
      String(store.merchant_id) !==
      String(user._id)
    ) {

      return res.status(409).json({

        success: false,

        error:
          "This Shopify store is already connected to another AI Commerce account"

      })

    }


    /*
    --------------------------------
    EXISTING STORE FOR THIS USER
    --------------------------------
    */

    if (store) {

      store.shopify.shop_id =
        String(shop_id)

      store.shopify.shop_domain =
        normalizedDomain

      store.shopify.connected =
        true

      store.platform =
        "shopify"

      store.platform_connected =
        true

      store.platform_connection_status =
        "connected"

      if (shop_name) {

        store.store_name =
          shop_name

      }

      await store.save()

    }


    /*
    --------------------------------
    CREATE NEW STORE
    --------------------------------
    */

    if (!store) {

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
            "USD",

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

    }


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
    RESPONSE
    --------------------------------
    */

    return res.json({

      success: true,

      authenticated: true,

      user,

      store_id:
        store._id,

      store: {

        id:
          store._id,

        store_name:
          store.store_name,

        platform:
          store.platform,

        platform_connected:
          store.platform_connected,

        shopify: {

          shop_id:
            store.shopify?.shop_id,

          shop_domain:
            store.shopify?.shop_domain,

          connected:
            store.shopify?.connected

        }

      },

      token:
        accessToken

    })

  } catch (error) {

    console.error(

      "Shopify store linking error:",

      error

    )


    return res.status(500).json({

      success: false,

      error:
        "Failed to link Shopify store",

      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message

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
      req.cookies
        ?.refresh_token


    if (!token) {

      return res.status(401).json({

        success: false,

        error:
          "No refresh token"

      })

    }


    /*
    --------------------------------
    VERIFY REFRESH TOKEN
    --------------------------------
    */

    const decoded =
      jwt.verify(

        token,

        process.env.JWT_REFRESH_SECRET

      )


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

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


    /*
    --------------------------------
    CREATE NEW ACCESS TOKEN
    --------------------------------
    */

    const accessToken =
      generateAccessToken(

        user

      )


    return res.json({

      success: true,

      token:
        accessToken

    })

  } catch (error) {

    console.error(

      "Refresh token error:",

      error

    )


    return res.status(401).json({

      success: false,

      error:
        "Invalid refresh token"

    })

  }

}


/*
================================
CURRENT SESSION
================================

Used by the frontend to restore
the authenticated user after reload.

The merchant dashboard gets the
User and the Store owned by that User.
================================
*/


async function getSession(
  req,
  res
) {

  try {

    const refreshTokenCookie =
      req.cookies
        ?.refresh_token


    if (!refreshTokenCookie) {

      return res.status(401).json({

        success: false,

        error:
          "No session"

      })

    }


    /*
    --------------------------------
    VERIFY REFRESH TOKEN
    --------------------------------
    */

    const decoded =
      jwt.verify(

        refreshTokenCookie,

        process.env.JWT_REFRESH_SECRET

      )


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

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


    /*
    --------------------------------
    ACCESS TOKEN
    --------------------------------
    */

    const accessToken =
      generateAccessToken(

        user

      )


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
          : null,

      store:
        store
          ? {

              id:
                store._id,

              store_name:
                store.store_name,

              platform:
                store.platform,

              platform_connected:
                store.platform_connected,

              platform_connection_status:
                store.platform_connection_status

            }

          : null

    })

  } catch (error) {

    console.error(

      "Session error:",

      error

    )


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

  linkShopifyStore,

  refreshToken,

  getSession,

  logout,

  generateAccessToken,

  generateRefreshToken

}