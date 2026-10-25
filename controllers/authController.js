const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")

const User = require("../models/user")
const Store = require("../models/store")
const Otp = require("../models/otp")

const emailService =
  require("../services/emailService")

const ShopifyAuthHandoff =
  require("../models/shopifyAuthHandoff")

const WooCommerceAuthHandoff = require("../models/woocommerceAuthHandoff");

const ShopifyPendingInstallation = require("../models/shopifyPendingInstallation");

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


function hashShopifyPendingToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createShopifyPendingInstallation({
  shop_id,
  shop_domain,
  shop_name,
  shop_email,
  currency,
}) {
  const token = crypto.randomBytes(32).toString("hex");

  await ShopifyPendingInstallation.create({
    token_hash: hashShopifyPendingToken(token),
    shop_id: String(shop_id),
    shop_domain: String(shop_domain).toLowerCase().trim(),
    shop_name: shop_name || "",
    shop_email: shop_email || null,
    currency,
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
  });

  return token;
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
  user,
  preferredStoreId = null
) {
  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  const store = preferredStoreId
    ? await Store.findOne({
        _id: preferredStoreId,
        merchant_id: user._id
      })
    : await Store.findOne({
        merchant_id: user._id
      })

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000
  })

  return res.json({
    success: true,
    token: accessToken,
    user,
    user_id: String(user._id),
    store_id: store ? String(store._id) : null
  })
}



/*
================================
SHOPIFY LOGIN HANDOFF
================================
*/

function getConfiguredDashboardOrigin() {
  const configuredUrl =
    process.env.GUAVA_DASHBOARD_URL ||
    process.env.DASHBOARD_URL

  if (!configuredUrl) {
    throw new Error(
      "GUAVA_DASHBOARD_URL or DASHBOARD_URL is not configured."
    )
  }

  const dashboardUrl = new URL(configuredUrl)

  if (dashboardUrl.protocol !== "https:") {
    throw new Error(
      "The dashboard URL must use HTTPS."
    )
  }

  return dashboardUrl.origin
}


function normalizeShopifyDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
}


async function createShopifyLoginHandoff(req, res) {
  try {
    if (!requirePlatformRequest(req, res)) {
      return
    }

    const {
      user_id,
      store_id,
      token,
      shop_id,
      shop_domain,
      return_to
    } = req.body || {}

    if (
      !user_id ||
      !store_id ||
      !token ||
      !shop_id ||
      !shop_domain ||
      !return_to
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required Shopify handoff fields."
      })
    }

    /*
    --------------------------------
    VERIFY MERCHANT IDENTITY TOKEN
    --------------------------------
    */

    let decoded

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      )
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired merchant identity token."
      })
    }

    if (String(decoded.id) !== String(user_id)) {
      return res.status(403).json({
        success: false,
        error: "Merchant identity does not match the token."
      })
    }

    const user = await User.findById(user_id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Merchant account not found."
      })
    }

    /*
    --------------------------------
    VALIDATE RETURN DESTINATION
    --------------------------------
    */

    let returnUrl

    try {
      returnUrl = new URL(return_to)

      const dashboardOrigin =
        getConfiguredDashboardOrigin()

      if (
        returnUrl.origin !== dashboardOrigin ||
        returnUrl.pathname !== "/auth/shopify/callback" ||
        returnUrl.protocol !== "https:"
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid Shopify return destination."
        })
      }
    } catch (error) {
      if (
        error.message ===
        "GUAVA_DASHBOARD_URL or DASHBOARD_URL is not configured."
      ) {
        throw error
      }

      return res.status(400).json({
        success: false,
        error: "Invalid Shopify return destination."
      })
    }

    /*
    --------------------------------
    VERIFY STORE OWNERSHIP
    --------------------------------
    */

    const normalizedDomain =
      normalizeShopifyDomain(shop_domain)

    const store = await Store.findOne({
      _id: store_id,
      merchant_id: user._id,
      platform: "shopify",
      "shopify.shop_id": String(shop_id),
      "shopify.shop_domain": normalizedDomain
    })

    if (!store) {
      return res.status(403).json({
        success: false,
        error: "Shopify store does not belong to this merchant."
      })
    }

    /*
    --------------------------------
    ISSUE ONE-TIME HANDOFF CODE
    --------------------------------
    */

    const code =
      crypto.randomBytes(32).toString("hex")

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(code)
        .digest("hex")

    const expiresAt =
      new Date(Date.now() + 5 * 60 * 1000)

    await ShopifyAuthHandoff.create({
      type: "login_handoff",
      token_hash: tokenHash,
      user_id: user._id,
      store_id: store._id,
      shop_id: String(shop_id),
      shop_domain: normalizedDomain,
      expires_at: expiresAt
    })

    return res.json({
      success: true,
      code,
      expires_in: 300
    })
  } catch (error) {
    console.error(
      "Shopify handoff creation failed:",
      error
    )

    return res.status(500).json({
      success: false,
      error: "Unable to create Shopify login handoff."
    })
  }
}


async function redeemShopifyLoginHandoff(req, res) {
  try {
    /*
    --------------------------------
    VALIDATE DASHBOARD ORIGIN
    --------------------------------
    */

    let dashboardOrigin

    try {
      dashboardOrigin =
        getConfiguredDashboardOrigin()
    } catch (error) {
      console.error(error)

      return res.status(500).json({
        success: false,
        error: "Dashboard origin is not configured."
      })
    }

    const requestOrigin = req.get("origin")

    if (
      requestOrigin &&
      requestOrigin !== dashboardOrigin
    ) {
      return res.status(403).json({
        success: false,
        error: "Invalid redemption origin."
      })
    }

    const code =
      String(req.body?.code || "").trim()

    if (!/^[a-f0-9]{64}$/i.test(code)) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired handoff code."
      })
    }

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(code)
        .digest("hex")

    /*
    --------------------------------
    ATOMIC SINGLE-USE REDEMPTION
    --------------------------------

    A concurrent or repeated request
    cannot consume the same code twice.
    --------------------------------
    */

    const handoff =
      await ShopifyAuthHandoff.findOneAndUpdate(
        {
          type: "login_handoff",
          token_hash: tokenHash,
          used_at: null,
          expires_at: {
            $gt: new Date()
          }
        },
        {
          $set: {
            used_at: new Date()
          }
        },
        {
          new: true
        }
      )

    if (!handoff) {
      return res.status(401).json({
        success: false,
        error: "Invalid, expired, or already-used handoff code."
      })
    }

    /*
    --------------------------------
    RECHECK MERCHANT AND STORE
    --------------------------------
    */

    const user = await User.findById(
      handoff.user_id
    )

    const store = handoff.store_id
      ? await Store.findOne({
          _id: handoff.store_id,
          merchant_id: handoff.user_id,
          platform: "shopify",
          "shopify.shop_id": handoff.shop_id,
          "shopify.shop_domain": handoff.shop_domain
        })
      : null

    if (!user || !store) {
      return res.status(401).json({
        success: false,
        error: "The Shopify merchant or store could not be verified."
      })
    }

    /*
    --------------------------------
    ESTABLISH EXISTING DASHBOARD SESSION
    --------------------------------

    Reuse the current JWT and refresh
    cookie implementation.
    --------------------------------
    */

    
return await createSessionAndRespond(
  res,
  user,
  handoff.store_id
)

  } catch (error) {
    console.error(
      "Shopify handoff redemption failed:",
      error
    )

    return res.status(500).json({
      success: false,
      error: "Unable to complete Shopify login."
    })
  }
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
        â†“
Shopify App
        â†“
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
  intendedUser,
  store._id
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
  user,
  store._id
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
  user,
  store._id
)

    }


    /*
    =================================
    NEW GUAVA MERCHANT
    =================================
    A new account is not created until
    email OTP verification succeeds.
    The pending token links this
    verified signup to this Shopify shop.
    =================================
    */
    const pendingInstallationToken =
      await createShopifyPendingInstallation({
        shop_id: String(shop_id),
        shop_domain: normalizedDomain,
        shop_name: shop_name || "",
        shop_email: normalizedEmail,
        currency: normalizedCurrency,
      });

    return res.json({
      success: true,
      authenticated: false,
      existing_user: false,
      requires_email_verification: true,
      requires_account_creation: true,
      pending_installation_token: pendingInstallationToken,
      shopify_identity: {
        shop_id: String(shop_id),
        shop_domain: normalizedDomain,
        shop_name: shop_name || null,
        email: normalizedEmail,
        currency: normalizedCurrency,
      },
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
|--------------------------------------------------------------------------
| WOOCOMMERCE AUTHENTICATION HANDOFF
|--------------------------------------------------------------------------
|
| Guava Dashboard
|       |
|       v
| Create single-use handoff
|       |
|       v
| WooCommerce plugin
|       |
|       v
| Redeem handoff
|       |
|       v
| Short-lived integration token
|
|--------------------------------------------------------------------------
*/

function normalizeWooCommerceUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());

    if (!["https:", "http:"].includes(parsed.protocol)) {
      return null;
    }

    if (
      parsed.protocol === "http:" &&
      !["localhost", "127.0.0.1"].includes(parsed.hostname)
    ) {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    // Canonicalize the store to its origin.
    // Paths, query strings and fragments are not retained.
    return parsed.origin;
  } catch {
    return null;
  }
}

function hashWooCommerceValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function generateWooCommerceIntegrationToken({
  merchantId,
  storeId,
  storeUrl,
}) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      type: "woocommerce_integration",
      merchant_id: String(merchantId),
      store_id: String(storeId),
      store_url: storeUrl,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
      issuer: "guava",
      audience: "woocommerce-plugin",
    }
  );
}

/*
|--------------------------------------------------------------------------
| CREATE WOOCOMMERCE HANDOFF
|--------------------------------------------------------------------------
|
| POST /api/auth/woocommerce/handoff
|
| Requires the existing Guava authentication middleware.
| The merchant identity comes from req.user, never the request body.
|
*/

async function createWooCommerceHandoff(req, res) {
  try {
    const authenticatedMerchantId = req.user?.id;
    if (!authenticatedMerchantId) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const { store_id, store_url, callback_url, state } = req.body || {};
    if (!store_id || !store_url || !callback_url || !state) {
      return res.status(400).json({ success: false, error: "Missing required WooCommerce handoff fields." });
    }
    if (typeof state !== "string" || !/^[a-f0-9]{64}$/i.test(state)) {
      return res.status(400).json({ success: false, error: "Invalid WooCommerce handoff state." });
    }

    const normalizedStoreUrl = normalizeWooCommerceUrl(store_url);
    if (!normalizedStoreUrl || !normalizedStoreUrl.startsWith("https://")) {
      return res.status(400).json({ success: false, error: "Invalid WooCommerce store URL." });
    }

    let callback;
    try {
      callback = new URL(String(callback_url).trim());
    } catch {
      return res.status(400).json({ success: false, error: "Invalid WordPress callback destination." });
    }

    const expectedCallbackOrigin = new URL(normalizedStoreUrl).origin;
    if (
      callback.protocol !== "https:" ||
      callback.origin !== expectedCallbackOrigin ||
      callback.pathname !== "/wp-admin/admin-post.php" ||
      callback.searchParams.get("action") !== "ai_commerce_woocommerce_return" ||
      callback.username ||
      callback.password ||
      callback.searchParams.has("code") ||
      (callback.searchParams.has("state") && callback.searchParams.get("state") !== state)
    ) {
      return res.status(400).json({ success: false, error: "Invalid WordPress callback destination." });
    }

    const merchant = await User.findById(authenticatedMerchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, error: "Merchant account not found." });
    }

    const store = await Store.findOne({
      _id: store_id,
      merchant_id: merchant._id,
      platform: "woocommerce",
    });

    if (!store) {
      return res.status(403).json({ success: false, error: "WooCommerce store does not belong to this merchant." });
    }

    const registeredStoreUrl = normalizeWooCommerceUrl(store.woocommerce?.store_url || "");
    if (!registeredStoreUrl || registeredStoreUrl !== normalizedStoreUrl) {
      return res.status(403).json({ success: false, error: "WooCommerce URL does not match the registered store." });
    }

    // State may be present because the dashboard validates and binds it
    // before calling this endpoint. Store a clean callback and add the
    // code/state only to the final redirect URL.
    callback.searchParams.delete("state");
    const cleanCallbackUrl = callback.toString();

    const code = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashWooCommerceValue(code);
    const stateHash = hashWooCommerceValue(state);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await WooCommerceAuthHandoff.create({
      token_hash: tokenHash,
      merchant_id: merchant._id,
      store_id: store._id,
      store_url: normalizedStoreUrl,
      callback_url: cleanCallbackUrl,
      state_hash: stateHash,
      expires_at: expiresAt,
      used_at: null,
    });

    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);

    return res.json({
      success: true,
      code,
      state,
      callback_url: callback.toString(),
      redirect_url: callback.toString(),
      expires_in: 300,
    });
  } catch (error) {
    console.error("WooCommerce handoff creation failed:", error);
    return res.status(500).json({ success: false, error: "Unable to create WooCommerce handoff." });
  }
}

/*
|--------------------------------------------------------------------------
| REDEEM WOOCOMMERCE HANDOFF
|--------------------------------------------------------------------------
|
| POST /api/auth/woocommerce/handoff/redeem
|
| Redeems a one-time code and issues a short-lived integration token.
| This does not, by itself, mark the WooCommerce store as connected.
|
*/

async function redeemWooCommerceHandoff(req, res) {
  try {
    const {
      code,
      state,
    } = req.body || {};

    if (
      typeof code !== "string" ||
      !/^[a-f0-9]{64}$/i.test(code) ||
      typeof state !== "string" ||
      state.length < 16 ||
      state.length > 512
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired WooCommerce handoff.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | HASH CODE AND STATE
    |--------------------------------------------------------------------------
    */

    const tokenHash = hashWooCommerceValue(code);
    const stateHash = hashWooCommerceValue(state);

    /*
    |--------------------------------------------------------------------------
    | ATOMIC SINGLE-USE REDEMPTION
    |--------------------------------------------------------------------------
    |
    | Only one concurrent request can consume a valid handoff.
    | Both the code and state hashes must match.
    |
    */

    const handoff =
      await WooCommerceAuthHandoff.findOneAndUpdate(
        {
          token_hash: tokenHash,
          state_hash: stateHash,
          used_at: null,
          expires_at: {
            $gt: new Date(),
          },
        },
        {
          $set: {
            used_at: new Date(),
          },
        },
        {
          new: true,
        }
      );

    if (!handoff) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid, expired, or already-used WooCommerce handoff.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REVERIFY MERCHANT AND STORE
    |--------------------------------------------------------------------------
    */

    const merchant = await User.findById(
      handoff.merchant_id
    );

    const store = await Store.findOne({
      _id: handoff.store_id,
      merchant_id: handoff.merchant_id,
      platform: "woocommerce",
    });

    if (!merchant || !store) {
      return res.status(401).json({
        success: false,
        error:
          "WooCommerce merchant or store could not be verified.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REVERIFY STORE URL
    |--------------------------------------------------------------------------
    */

    const registeredStoreUrl = normalizeWooCommerceUrl(
      store.woocommerce?.store_url || ""
    );

    if (
      !registeredStoreUrl ||
      registeredStoreUrl !== handoff.store_url
    ) {
      return res.status(401).json({
        success: false,
        error: "WooCommerce store URL verification failed.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ISSUE SHORT-LIVED INTEGRATION TOKEN
    |--------------------------------------------------------------------------
    */

    const integrationToken =
      generateWooCommerceIntegrationToken({
        merchantId: merchant._id,
        storeId: store._id,
        storeUrl: handoff.store_url,
      });

    return res.json({
      success: true,
      token: integrationToken,
      integration_token: integrationToken,
      store_id: String(store._id),
      store_url: handoff.store_url,
      callback_url: handoff.callback_url,
      expires_in: 900,
    });
  } catch (error) {
    console.error(
      "WooCommerce handoff redemption failed:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Unable to redeem WooCommerce handoff.",
    });
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
    const shopifyPendingToken =
      String(req.body.shopify_pending_token || "").trim();

    let pendingShopifyInstallation = null;
    let preferredStoreId = null;

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
    VALIDATE OPTIONAL SHOPIFY INSTALL
    --------------------------------
    */
    if (shopifyPendingToken) {
      if (purpose !== "signup") {
        return res.status(400).json({
          success: false,
          error: "Shopify installation can only be linked during signup.",
        });
      }

      pendingShopifyInstallation =
        await ShopifyPendingInstallation.findOne({
          token_hash: hashShopifyPendingToken(shopifyPendingToken),
          used_at: null,
          expires_at: { $gt: new Date() },
        });

      if (!pendingShopifyInstallation) {
        return res.status(400).json({
          success: false,
          error: "This Shopify registration link has expired or has already been used. Restart Shopify signup.",
        });
      }

      const existingShopifyStore = await Store.findOne({
        platform: "shopify",
        $or: [
          { "shopify.shop_id": pendingShopifyInstallation.shop_id },
          { "shopify.shop_domain": pendingShopifyInstallation.shop_domain },
        ],
      });

      if (existingShopifyStore) {
        return res.status(409).json({
          success: false,
          error: "This Shopify store is already registered. Sign in to the existing Guava account.",
        });
      }
    }

    /*
    --------------------------------
    MARK OTP VERIFIED
    --------------------------------
    */
    otpRecord.verified = true;
    await otpRecord.save();


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
      if (pendingShopifyInstallation) {
        let consumedInstallation = null;

        try {
          consumedInstallation =
            await ShopifyPendingInstallation.findOneAndUpdate(
              {
                _id: pendingShopifyInstallation._id,
                token_hash: hashShopifyPendingToken(shopifyPendingToken),
                used_at: null,
                expires_at: { $gt: new Date() },
              },
              { $set: { used_at: new Date() } },
              { new: true }
            );

          if (!consumedInstallation) {
            await User.deleteOne({ _id: user._id });

            otpRecord.verified = false;
            await otpRecord.save();

            return res.status(409).json({
              success: false,
              error: "This Shopify registration link has already been used or expired. Restart Shopify signup.",
            });
          }

          const store = await Store.create({
            merchant_id: user._id,
            store_name:
              consumedInstallation.shop_name ||
              consumedInstallation.shop_domain,
            currency: consumedInstallation.currency,
            platform: "shopify",
            platform_connected: false,
            platform_connection_status: "connecting",
            shopify: {
              shop_id: consumedInstallation.shop_id,
              shop_domain: consumedInstallation.shop_domain,
              connected: false,
            },
          });

          preferredStoreId = store._id;
        } catch (shopifySignupError) {
          console.error(
            "Shopify signup setup failed; attempting recovery:",
            shopifySignupError
          );

          // Remove only a Shopify store associated with this new user
          // and the installation being registered.
          try {
            await Store.deleteOne({
              merchant_id: user._id,
              platform: "shopify",
              $or: [
                { "shopify.shop_id": pendingShopifyInstallation.shop_id },
                { "shopify.shop_domain": pendingShopifyInstallation.shop_domain },
              ],
            });
          } catch (cleanupError) {
            console.error("Shopify store cleanup failed:", cleanupError);
          }

          // Make the pending link reusable if this attempt consumed it.
          if (consumedInstallation) {
            try {
              await ShopifyPendingInstallation.updateOne(
                {
                  _id: consumedInstallation._id,
                  token_hash: hashShopifyPendingToken(shopifyPendingToken),
                  used_at: { $ne: null },
                },
                { $set: { used_at: null } }
              );
            } catch (restoreError) {
              console.error("Shopify token restoration failed:", restoreError);
            }
          }

          // This user was created immediately before this Shopify block.
          try {
            await User.deleteOne({ _id: user._id });
          } catch (cleanupError) {
            console.error("New user cleanup failed:", cleanupError);
          }

          try {
            otpRecord.verified = false;
            await otpRecord.save();
          } catch (otpRecoveryError) {
            console.error("OTP recovery failed:", otpRecoveryError);
          }

          return res.status(500).json({
            success: false,
            error: "Shopify signup could not be completed. Please retry the registration.",
          });
        }
      }

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

    return createSessionAndRespond(res, user, preferredStoreId)

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

  createShopifyLoginHandoff,
 redeemShopifyLoginHandoff,

 createWooCommerceHandoff,
  redeemWooCommerceHandoff,

  generateRefreshToken

}



