const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")

const User = require("../models/user")
const Store = require("../models/store")
const Otp = require("../models/otp")

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

function authenticatePlatformRequest(req) {

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

      httpOnly:
        true,

      secure:
        true,

      sameSite:
        "none",

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

    success:
      true,

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


function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    .test(email)

}


/*
================================
SHOPIFY CONNECTION INTENT
================================

This is the bridge between:

Guava Web Dashboard
        ↓
Shopify App
        ↓
Guava Identity

A web-authenticated Guava user
can create a short-lived signed
connection intent.

The Shopify App receives this
intent after Shopify authentication
and sends it back to the platform.

The intent tells Guava:

"This Shopify connection was
started by this authenticated
Guava user."

IMPORTANT:

The browser never supplies
merchant_id directly.

The merchant identity is encoded
inside a server-signed token.
================================
*/


function generateShopifyConnectionIntent(
  user
) {

  const jti =
    crypto.randomUUID()


  return jwt.sign(

    {
      type:
        "shopify_connection",

      jti,

      user_id:
        String(user._id),

      email:
        user.email

    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        "10m"
    }

  )

}


/*
--------------------------------
VERIFY SHOPIFY CONNECTION INTENT
--------------------------------
*/

function verifyShopifyConnectionIntent(
  token
) {

  if (!token) {

    return null

  }

  try {

    const decoded =
      jwt.verify(

        token,

        process.env.JWT_SECRET

      )


    if (
      decoded?.type !==
      "shopify_connection"
    ) {

      return null

    }


    if (!decoded?.user_id) {

      return null

    }


    return decoded

  } catch (error) {

    return null

  }

}


/*
================================
CREATE SHOPIFY CONNECTION INTENT
================================

POST /api/auth/shopify/connection-intent

Requires the normal Guava JWT.

This endpoint is called by the
Guava dashboard before sending
the merchant to Shopify.

The returned token is short-lived
and only identifies the Guava
account that initiated the
connection.
================================
*/

async function createShopifyConnectionIntent(
  req,
  res
) {

  try {

    /*
    --------------------------------
    AUTHENTICATED USER
    --------------------------------
    */

    if (!req.user?.id) {

      return res.status(401).json({

        success:
          false,

        error:
          "Authentication required"

      })

    }


    /*
    --------------------------------
    LOAD USER
    --------------------------------
    */

    const user =
      await User.findById(
        req.user.id
      )


    if (!user) {

      return res.status(404).json({

        success:
          false,

        error:
          "User not found"

      })

    }


    /*
    --------------------------------
    CREATE INTENT
    --------------------------------
    */

    const intent =
      generateShopifyConnectionIntent(
        user
      )


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success:
        true,

      intent,

      expires_in:
        600

    })

  } catch (error) {

    console.error(

      "Shopify connection intent error:",

      error

    )


    return res.status(500).json({

      success:
        false,

      error:
        "Failed to create Shopify connection intent"

    })

  }

}


/*
================================
PLATFORM AUTHENTICATION
FOR SHOPIFY CONNECTION
================================

Validates the internal Shopify
App request.

The Shopify App must authenticate
itself using the platform key.
================================
*/


function requirePlatformRequest(
  req,
  res
) {

  if (
    !authenticatePlatformRequest(req)
  ) {

    res.status(401).json({

      success:
        false,

      error:
        "Unauthorized platform request"

    })

    return false

  }

  return true

}


/*
================================
SHOPIFY MERCHANT IDENTITY
================================

POST /api/auth/shopify/identify

There are THREE possible situations.

1. Shopify-first merchant

The merchant installed the Shopify
app before creating a Guava account.

2. Web-first merchant

The merchant already has a Guava
account and later connects Shopify.

3. Web-first explicit connection

The merchant is authenticated in
Guava and intentionally clicked
"Connect Shopify".

In case 3, the signed connection
intent determines exactly which
Guava User owns the Shopify store.

IMPORTANT:

The browser never supplies
merchant_id.
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
      !requirePlatformRequest(
        req,
        res
      )
    ) {

      return

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

      currency,

      connection_intent

    } =
      req.body


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

        success:
          false,

        error:
          "shop_id is required"

      })

    }


    if (!normalizedDomain) {

      return res.status(400).json({

        success:
          false,

        error:
          "shop_domain is required"

      })

    }


    /*
    =================================
    VERIFY CONNECTION INTENT
    =================================
    */

    const connectionIntent =
      verifyShopifyConnectionIntent(
        connection_intent
      )


    let intendedUser = null


    if (connectionIntent) {

      intendedUser =
        await User.findById(
          connectionIntent.user_id
        )


      if (!intendedUser) {

        return res.status(401).json({

          success:
            false,

          error:
            "Shopify connection account no longer exists"

        })

      }

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
    EXPLICIT WEB-FIRST CONNECTION
    =================================

    If the merchant initiated
    Shopify connection from the
    authenticated Guava dashboard,
    the signed connection intent
    is authoritative.

    We do NOT use shop_email to
    choose another merchant.
    =================================
    */

    if (intendedUser) {

      /*
      --------------------------------
      EXISTING SHOPIFY STORE
      --------------------------------
      */

      if (store) {

        const existingOwner =
          await User.findById(
            store.merchant_id
          )


        /*
        --------------------------------
        SECURITY CHECK
        --------------------------------

        A Shopify store already owned
        by another Guava user cannot
        be silently claimed.
        --------------------------------
        */

        if (
          existingOwner &&
          String(
            existingOwner._id
          ) !==
          String(
            intendedUser._id
          )
        ) {

          return res.status(409).json({

            success:
              false,

            error:
              "This Shopify store is already connected to another Guava account"

          })

        }


        /*
        --------------------------------
        REPAIR MISSING OWNER
        --------------------------------
        */

        store.merchant_id =
          intendedUser._id

      } else {

        /*
        --------------------------------
        CREATE STORE FOR INTENDED USER
        --------------------------------
        */

        store =
          await Store.create({

            merchant_id:
              intendedUser._id,

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

      }


      /*
      --------------------------------
      UPDATE SHOPIFY CONNECTION
      --------------------------------
      */

      store.shopify =
        store.shopify || {}


      store.shopify.shop_id =
        String(shop_id)


      store.shopify.shop_domain =
        normalizedDomain


      store.shopify.connected =
        true


      if (shop_name) {

        store.store_name =
          shop_name

      }


      store.currency =
        normalizedCurrency


      store.platform =
        "shopify"


      store.platform_connected =
        true


      store.platform_connection_status =
        "connected"


      await store.save()


      /*
      --------------------------------
      CREATE GUARAV SESSION
      --------------------------------

      The authenticated Guava user
      remains the canonical identity.
      --------------------------------
      */

      return createSessionAndRespond(

        res,

        intendedUser

      )

    }


    /*
    =================================
    EXISTING SHOPIFY STORE
    =================================

    Shopify-first returning merchant.

    The existing Store determines
    ownership.
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


      /*
      --------------------------------
      STORE WITHOUT USER
      --------------------------------
      */

      if (!user) {

        return res.status(409).json({

          success:
            false,

          error:
            "Shopify store exists but its merchant account could not be found"

        })

      }


      /*
      --------------------------------
      ENSURE SHOPIFY OBJECT
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
      STORE NAME
      --------------------------------
      */

      if (shop_name) {

        store.store_name =
          shop_name

      }


      /*
      --------------------------------
      CURRENCY
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


      await store.save()


      /*
      --------------------------------
      CREATE GUARAVA SESSION
      --------------------------------
      */

      return createSessionAndRespond(

        res,

        user

      )

    }


    /*
    =================================
    NEW SHOPIFY STORE
    =================================
    */

    if (!normalizedEmail) {

      return res.status(400).json({

        success:
          false,

        error:
          "shop_email is required for a new Shopify identity"

      })

    }


    if (
      !isValidEmail(
        normalizedEmail
      )
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          "Invalid Shopify merchant email"

      })

    }


    /*
    =================================
    FIND EXISTING GUARVA USER
    =================================
    */

    let user =
      await User.findOne({

        email:
          normalizedEmail

      })


    /*
    =================================
    EXISTING GUARVA USER
    =================================

    This is the WEB-FIRST path when
    no explicit connection intent was
    supplied.

    We attach the Shopify store to
    the existing User.
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


      /*
      --------------------------------
      EXISTING SHOPIFY STORE
      --------------------------------
      */

      if (existingShopifyStore) {

        /*
        If the Shopify domain is
        different, don't silently
        replace the connection.
        */

        if (
          existingShopifyStore.shopify?.shop_domain &&
          existingShopifyStore.shopify.shop_domain !==
            normalizedDomain
        ) {

          return res.status(409).json({

            success:
              false,

            error:
              "This Guava account already has a Shopify store"

          })

        }


        store =
          existingShopifyStore

      } else {

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

      }


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
    NEW GUARVA MERCHANT
    =================================

    No User exists yet.

    We DO NOT create an account merely
    because Shopify supplied an email.

    The Shopify merchant must complete
    account creation / verification.
    =================================
    */

    return res.json({

      success:
        true,

      authenticated:
        false,

      existing_user:
        false,

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
          shop_name ||
          null,

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

      success:
        false,

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

OTP is stored in the dedicated
Otp collection.

This allows registration OTPs
to work before a User exists.
================================
*/

async function sendOtp(
  req,
  res
) {

  try {

    /*
    --------------------------------
    NORMALIZE EMAIL
    --------------------------------
    */

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

        success:
          false,

        error:
          "Email is required"

      })

    }


    if (
      !isValidEmail(email)
    ) {

      return res.status(400).json({

        success:
          false,

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
    DETERMINE OTP PURPOSE
    --------------------------------

    signup
      New account

    signin
      Existing account

    If the frontend doesn't explicitly
    provide a purpose, determine it
    from whether the account exists.
    --------------------------------
    */

    const requestedPurpose =
      String(
        req.body.purpose || ""
      )

        .trim()

        .toLowerCase()


    let purpose


    if (
      requestedPurpose ===
      "signup"
    ) {

      purpose =
        "signup"

    } else if (
      requestedPurpose ===
      "signin"
    ) {

      purpose =
        "signin"

    } else {

      purpose =
        user
          ? "signin"
          : "signup"

    }


    /*
    --------------------------------
    EXISTING ACCOUNT + SIGNUP
    --------------------------------
    */

    if (
      purpose === "signup" &&
      user
    ) {

      return res.status(409).json({

        success:
          false,

        error:
          "An account with this email already exists. Please sign in."

      })

    }


    /*
    --------------------------------
    NEW ACCOUNT + SIGNIN
    --------------------------------
    */

    if (
      purpose === "signin" &&
      !user
    ) {

      return res.status(404).json({

        success:
          false,

        error:
          "No account exists with this email. Please create an account."

      })

    }


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


    /*
    --------------------------------
    OTP EXPIRATION
    --------------------------------
    */

    const expiresAt =
      new Date(

        Date.now() +
        10 *
        60 *
        1000

      )


    /*
    --------------------------------
    REMOVE PREVIOUS OTP
    --------------------------------
    */

    await Otp.deleteMany({

      email,

      purpose

    })


    /*
    --------------------------------
    STORE OTP
    --------------------------------
    */

    await Otp.create({

      email,

      otp,

      purpose,

      expires_at:
        expiresAt,

      attempts:
        0,

      verified:
        false

    })


    /*
    --------------------------------
    SEND EMAIL
    --------------------------------
    */

    await emailService.sendOtpEmail({

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

      success:
        true,

      message:
        "Verification code sent"

    })

  } catch (error) {

    console.error(

      "Send OTP error:",

      error

    )


    return res.status(500).json({

      success:
        false,

      error:
        "Failed to send verification code"

    })

  }

}


/*
================================
VERIFY OTP
================================

Handles:

1. New merchant registration
2. Existing merchant sign in
================================
*/

async function verifyOtp(
  req,
  res
) {

  try {

    /*
    --------------------------------
    NORMALIZE INPUT
    --------------------------------
    */

    const email =
      normalizeEmail(
        req.body.email
      )


    const otp =
      String(
        req.body.otp || ""
      )

        .trim()


    const requestedPurpose =
      String(
        req.body.purpose || ""
      )

        .trim()

        .toLowerCase()


    /*
    --------------------------------
    VALIDATE EMAIL
    --------------------------------
    */

    if (!email) {

      return res.status(400).json({

        success:
          false,

        error:
          "Email is required"

      })

    }


    if (
      !isValidEmail(email)
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          "Invalid email"

      })

    }


    /*
    --------------------------------
    VALIDATE OTP
    --------------------------------
    */

    if (!otp) {

      return res.status(400).json({

        success:
          false,

        error:
          "Verification code is required"

      })

    }


    if (
      !/^\d{6}$/.test(otp)
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          "Verification code must be 6 digits"

      })

    }


    /*
    --------------------------------
    DETERMINE PURPOSE
    --------------------------------
    */

    let purpose


    if (
      requestedPurpose ===
      "signup"
    ) {

      purpose =
        "signup"

    } else if (
      requestedPurpose ===
      "signin"
    ) {

      purpose =
        "signin"

    } else {

      const existingUser =
        await User.findOne({

          email

        })


      purpose =
        existingUser
          ? "signin"
          : "signup"

    }


    /*
    --------------------------------
    FIND OTP
    --------------------------------
    */

    const otpRecord =
      await Otp.findOne({

        email,

        otp,

        purpose,

        verified:
          false

      })


    /*
    --------------------------------
    INVALID OTP
    --------------------------------
    */

    if (!otpRecord) {

      return res.status(400).json({

        success:
          false,

        error:
          "Invalid verification code"

      })

    }


    /*
    --------------------------------
    CHECK EXPIRATION
    --------------------------------
    */

    if (
      !otpRecord.expires_at ||
      otpRecord.expires_at <=
        new Date()
    ) {

      await Otp.deleteOne({

        _id:
          otpRecord._id

      })


      return res.status(400).json({

        success:
          false,

        error:
          "Verification code has expired"

      })

    }


    /*
    --------------------------------
    MARK OTP VERIFIED
    --------------------------------
    */

    otpRecord.verified =
      true

    await otpRecord.save()


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
    =================================
    SIGNUP
    =================================
    */

    if (
      purpose === "signup"
    ) {

      /*
      --------------------------------
      ACCOUNT ALREADY EXISTS
      --------------------------------
      */

      if (user) {

        await Otp.deleteMany({

          email

        })


        return res.status(409).json({

          success:
            false,

          error:
            "An account with this email already exists. Please sign in."

        })

      }


      /*
      --------------------------------
      GET NAME
      --------------------------------
      */

      const name =
        String(
          req.body.name || ""
        )

          .trim()


      if (!name) {

        return res.status(400).json({

          success:
            false,

          error:
            "Name is required to create your account"

        })

      }


      /*
      --------------------------------
      CREATE USER
      --------------------------------
      */

      user =
        await User.create({

          name,

          email,

          password:
            null,

          email_verified:
            true,

          email_verified_at:
            new Date(),

          identity_provider:
            "email",

          plan:
            "free"

        })

    }


    /*
    =================================
    SIGN IN
    =================================
    */

    if (
      purpose === "signin"
    ) {

      /*
      --------------------------------
      USER MUST EXIST
      --------------------------------
      */

      if (!user) {

        await Otp.deleteMany({

          email

        })


        return res.status(404).json({

          success:
            false,

          error:
            "Account not found. Please create an account."

        })

      }


      /*
      --------------------------------
      VERIFY EMAIL
      --------------------------------
      */

      if (
        !user.email_verified
      ) {

        user.email_verified =
          true

        user.email_verified_at =
          new Date()

        await user.save()

      }

    }


    /*
    --------------------------------
    INVALIDATE REMAINING OTPS
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

      success:
        false,

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

        success:
          false,

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

        success:
          false,

        error:
          "User not found"

      })

    }


    const accessToken =
      generateAccessToken(user)


    return res.json({

      success:
        true,

      token:
        accessToken

    })

  } catch (error) {

    return res.status(401).json({

      success:
        false,

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

        success:
          false,

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

        success:
          false,

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

      success:
        true,

      user,

      store_id:
        store
          ? store._id
          : null

    })

  } catch (error) {

    return res.status(401).json({

      success:
        false,

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

      httpOnly:
        true,

      secure:
        true,

      sameSite:
        "none"

    }

  )


  return res.json({

    success:
      true,

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

  createShopifyConnectionIntent,

  refreshToken,

  getSession,

  logout,

  generateAccessToken,

  generateRefreshToken

}