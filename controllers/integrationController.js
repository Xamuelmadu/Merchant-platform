const axios = require("axios")

const crypto = require("crypto")

const Store = require("../models/store")

const IntegrationToken = require("../models/integrationToken")

const {
  createCustomerConversationToken
} = require("../services/customerConversationToken")

const {
  connectShopifyStore
} = require("../services/shopifyConnectionService")

const {
  syncShopifyProducts
} = require("../services/shopifyService")

const {
  syncWooProducts
} = require("../services/woocommerceService")

/*
================================
GET PAYMENT SETTINGS
================================

GET /api/integrations/payments

================================
*/

async function getPayments(req, res) {
  try {
    const store = req.store

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    return res.json({
      stripe_enabled: !!store.stripe_public_key,
      stripe_public_key: store.stripe_public_key || "",
      paystack_enabled: !!store.paystack_public_key,
      paystack_public_key: store.paystack_public_key || ""
    })
  } catch (error) {
    console.error(
      "Get payments error:",
      error
    )

    return res.status(500).json({
      error: "Failed to load payment settings"
    })
  }
}

/*
================================
UPDATE PAYMENT SETTINGS
================================

POST /api/integrations/payments/update

================================
*/

async function updatePayments(req, res) {
  try {
    const store = req.store

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    const {
      stripe_public_key,
      stripe_secret_key,
      paystack_public_key,
      paystack_secret_key
    } = req.body

    if (stripe_public_key !== undefined) {
      store.stripe_public_key = stripe_public_key
    }

    if (stripe_secret_key !== undefined) {
      store.stripe_secret_key = stripe_secret_key
    }

    if (paystack_public_key !== undefined) {
      store.paystack_public_key = paystack_public_key
    }

    if (paystack_secret_key !== undefined) {
      store.paystack_secret_key = paystack_secret_key
    }

    await store.save()

    return res.json({
      message: "Payment settings updated"
    })
  } catch (error) {
    console.error(
      "Update payments error:",
      error
    )

    return res.status(500).json({
      error: "Unable to update payment settings"
    })
  }
}

/*
================================
CONNECT SHOPIFY
================================

POST /api/integrations/shopify/connect

================================
*/

async function connectShopify(req, res) {
  try {
    /*
    --------------------------------
    INTERNAL PLATFORM AUTH
    --------------------------------
    */

    const platformKey =
      req.headers["x-platform-key"]

    if (
      !process.env.AI_COMMERCE_PLATFORM_KEY ||
      platformKey !==
        process.env.AI_COMMERCE_PLATFORM_KEY
    ) {
      return res.status(401).json({
        error: "Unauthorized platform request"
      })
    }

    /*
    --------------------------------
    INPUT
    --------------------------------
    */

    const {
      shop_domain,
      shop_id,
      shop_name,
      shop_email,
      access_token,
      currency
    } = req.body

    if (!shop_domain) {
      return res.status(400).json({
        error: "shop_domain is required"
      })
    }

    if (!shop_id) {
      return res.status(400).json({
        error: "shop_id is required"
      })
    }

    if (!access_token) {
      return res.status(400).json({
        error: "access_token is required"
      })
    }

    /*
    --------------------------------
    NORMALIZE SHOPIFY CURRENCY
    --------------------------------
    */

    const normalizedCurrency =
      String(currency || "")
        .trim()
        .toUpperCase()

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      return res.status(400).json({
        error:
          "currency is required and must be a valid 3-letter currency code"
      })
    }

    /*
    --------------------------------
    CONNECT
    --------------------------------
    */

    const result =
      await connectShopifyStore({
        shopDomain: shop_domain,
        shopId: shop_id,
        shopName: shop_name,
        shopEmail: shop_email,
        accessToken: access_token,
        currency: normalizedCurrency
      })

    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({
      success: true,
      created: result.created,
      store: {
        id: result.store._id,
        store_name: result.store.store_name,
        platform: result.store.platform,
        platform_connected:
          result.store.platform_connected,
        platform_connection_status:
          result.store.platform_connection_status,
        currency: result.store.currency,
        shopify: {
          shop_id:
            result.store.shopify?.shop_id,
          shop_domain:
            result.store.shopify?.shop_domain,
          connected:
            result.store.shopify?.connected
        }
      }
    })
  } catch (error) {
    console.error(
      "Shopify connection error:",
      error
    )

    return res.status(500).json({
      error:
        "Failed to connect Shopify store",
      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message
    })
  }
}

/*
================================
GET SHOPIFY STORE
================================

GET /api/integrations/shopify/store

================================
*/

async function getShopifyStore(req, res) {
  try {
    /*
    --------------------------------
    INTERNAL PLATFORM AUTH
    --------------------------------
    */

    const platformKey =
      req.headers["x-platform-key"]

    if (
      !process.env.AI_COMMERCE_PLATFORM_KEY ||
      platformKey !==
        process.env.AI_COMMERCE_PLATFORM_KEY
    ) {
      return res.status(401).json({
        error: "Unauthorized platform request"
      })
    }

    /*
    --------------------------------
    SHOP DOMAIN
    --------------------------------
    */

    const shopDomain =
      String(
        req.query.shop || ""
      )
        .trim()
        .toLowerCase()

    if (!shopDomain) {
      return res.status(400).json({
        error: "shop is required"
      })
    }

    /*
    --------------------------------
    FIND CONNECTED SHOPIFY STORE
    --------------------------------
    */

    const store =
      await Store.findOne({
        "shopify.shop_domain":
          shopDomain,
        platform: "shopify",
        platform_connected: true,
        "shopify.connected": true
      })

    if (!store) {
      return res.status(404).json({
        error:
          "Connected Shopify store not found"
      })
    }

    /*
    --------------------------------
    RETURN CHANNEL STORE
    --------------------------------
    */

    return res.json({
      success: true,
      store: {
        id: String(store._id),
        store_name: store.store_name,
        platform: store.platform,
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
      }
    })
  } catch (error) {
    console.error(
      "Resolve Shopify store error:",
      error
    )

    return res.status(500).json({
      error:
        "Failed to resolve Shopify store"
    })
  }
}

/*
================================
SYNC SHOPIFY PRODUCTS
================================

POST /api/integrations/shopify/products/sync

================================
*/

async function syncShopifyProductsController(
  req,
  res
) {
  try {
    /*
    --------------------------------
    INTERNAL PLATFORM AUTH
    --------------------------------
    */

    const platformKey =
      req.headers["x-platform-key"]

    const integrationSecret =
      req.headers[
        "x-shopify-integration-secret"
      ]

    const validPlatformKey =
      process.env.AI_COMMERCE_PLATFORM_KEY &&
      platformKey ===
        process.env.AI_COMMERCE_PLATFORM_KEY

    const validIntegrationSecret =
      process.env.SHOPIFY_INTEGRATION_SECRET &&
      integrationSecret ===
        process.env.SHOPIFY_INTEGRATION_SECRET

    if (
      !validPlatformKey &&
      !validIntegrationSecret
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
      shop,
      products
    } = req.body

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: "shop is required"
      })
    }

    if (!Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error:
          "products must be an array"
      })
    }

    /*
    --------------------------------
    FIND SHOPIFY STORE
    --------------------------------
    */

    const store =
      await Store.findOne({
        "shopify.shop_domain":
          String(shop)
            .trim()
            .toLowerCase(),
        platform: "shopify",
        platform_connected: true,
        "shopify.connected": true
      })

    if (!store) {
      return res.status(404).json({
        success: false,
        error:
          "Connected Shopify store not found"
      })
    }

    /*
    --------------------------------
    SYNC
    --------------------------------
    */

    const result =
      await syncShopifyProducts({
        store,
        products
      })

    return res.json({
      success: true,
      synced: result.synced,
      store_id: String(store._id)
    })
  } catch (error) {
    console.error(
      "Shopify product sync error:",
      error
    )

    return res.status(500).json({
      success: false,
      error:
        "Failed to synchronize Shopify products",
      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message
    })
  }
}

/*
================================
CONNECT WOOCOMMERCE
================================

POST /api/integrations/woocommerce/connect

================================
*/

async function connectWooCommerce(
  req,
  res
) {
  try {
    /*
    --------------------------------
    AUTHENTICATED STORE
    --------------------------------
    */

    const store = req.store

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found"
      })
    }

    /*
    --------------------------------
    INPUT
    --------------------------------
    */

    const {
      store_url,
      consumer_key,
      consumer_secret
    } = req.body

    if (!store_url) {
      return res.status(400).json({
        success: false,
        error:
          "store_url is required"
      })
    }

    if (!consumer_key) {
      return res.status(400).json({
        success: false,
        error:
          "consumer_key is required"
      })
    }

    if (!consumer_secret) {
      return res.status(400).json({
        success: false,
        error:
          "consumer_secret is required"
      })
    }

    /*
    --------------------------------
    NORMALIZE URL
    --------------------------------
    */

    let normalizedStoreUrl

    try {
      const parsedUrl =
        new URL(
          String(
            store_url
          ).trim()
        )

      if (
        parsedUrl.protocol !==
          "http:" &&
        parsedUrl.protocol !==
          "https:"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid WooCommerce store URL"
        })
      }

      normalizedStoreUrl =
        parsedUrl
          .toString()
          .replace(
            /\/+$/,
            ""
          )
    } catch {
      return res.status(400).json({
        success: false,
        error:
          "Invalid WooCommerce store URL"
      })
    }

    /*
    --------------------------------
    TEST WOOCOMMERCE CONNECTION
    --------------------------------
    */

    const response =
      await axios.get(
        `${normalizedStoreUrl}/wp-json/wc/v3/system_status`,
        {
          auth: {
            username:
              consumer_key,
            password:
              consumer_secret
          },
          timeout: 15000
        }
      )

    /*
    --------------------------------
    GET WOOCOMMERCE CURRENCY
    --------------------------------
    */

    let currency =
      String(
        response
          ?.data
          ?.settings
          ?.currency || ""
      )
        .trim()
        .toUpperCase()

    if (!currency) {
      try {
        const currencyResponse =
          await axios.get(
            `${normalizedStoreUrl}/wp-json/wc/v3/settings/general`,
            {
              auth: {
                username:
                  consumer_key,
                password:
                  consumer_secret
              },
              timeout: 15000
            }
          )

        const currencySetting =
          Array.isArray(
            currencyResponse?.data
          )
            ? currencyResponse.data.find(
                item =>
                  item?.id ===
                  "woocommerce_currency"
              )
            : null

        currency =
          String(
            currencySetting?.value ||
              ""
          )
            .trim()
            .toUpperCase()
      } catch (currencyError) {
        console.error(
          "WooCommerce currency retrieval failed:",
          currencyError.message
        )
      }
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({
        success: false,
        error:
          "Unable to determine WooCommerce store currency"
      })
    }

    /*
    --------------------------------
    SAVE CONNECTION
    --------------------------------
    */

    store.platform =
      "woocommerce"

    store.platform_connected =
      true

    store.platform_connection_status =
      "connected"

    store.platform_sync_error =
      undefined

    store.currency =
      currency

    store.woocommerce = {
      ...(store.woocommerce?.toObject
        ? store.woocommerce.toObject()
        : store.woocommerce || {}),
      store_url:
        normalizedStoreUrl,
      consumer_key,
      consumer_secret,
      connected: true
    }

    await store.save()

    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({
      success: true,
      message:
        "WooCommerce store connected successfully",
      store: {
        id: String(store._id),
        store_name:
          store.store_name,
        platform:
          store.platform,
        platform_connected:
          store.platform_connected,
        platform_connection_status:
          store.platform_connection_status,
        currency:
          store.currency,
        woocommerce: {
          store_url:
            store.woocommerce.store_url,
          connected:
            store.woocommerce.connected
        }
      },
      woocommerce: {
        version:
          response
            .data
            ?.environment
            ?.version || null,
        currency
      }
    })
  } catch (error) {
    console.error(
      "WooCommerce connection error:",
      error.message
    )

    /*
    --------------------------------
    UPDATE CONNECTION ERROR
    --------------------------------
    */

    try {
      const store =
        req.store

      if (store) {
        store.platform =
          "woocommerce"

        store.platform_connected =
          false

        store.platform_connection_status =
          "error"

        store.platform_sync_error =
          error.message

        if (store.woocommerce) {
          store.woocommerce.connected =
            false
        }

        await store.save()
      }
    } catch (stateError) {
      console.error(
        "Failed to save WooCommerce connection error:",
        stateError.message
      )
    }

    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    const status =
      error.response?.status

    return res.status(
      status &&
      status >= 400 &&
      status < 500
        ? status
        : 500
    ).json({
      success: false,
      error:
        "Failed to connect WooCommerce store",
      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message
    })
  }
}

/*
================================
SYNC WOOCOMMERCE PRODUCTS
================================

POST /api/integrations/woocommerce/products/sync

================================
*/

async function syncWooCommerceProductsController(
  req,
  res
) {
  try {
    const store = req.store

    if (!store) {
      return res.status(404).json({
        success: false,
        error: "Store not found"
      })
    }

    /*
    --------------------------------
    USE SAVED CONNECTION
    --------------------------------
    */

    const storeUrl =
      store
        .woocommerce
        ?.store_url

    const consumerKey =
      store
        .woocommerce
        ?.consumer_key

    const consumerSecret =
      store
        .woocommerce
        ?.consumer_secret

    if (
      !storeUrl ||
      !consumerKey ||
      !consumerSecret
    ) {
      return res.status(400).json({
        success: false,
        error:
          "WooCommerce store is not connected"
      })
    }

    /*
    --------------------------------
    SYNC
    --------------------------------
    */

    const synced =
      await syncWooProducts(
        store._id,
        storeUrl,
        consumerKey,
        consumerSecret
      )

    return res.json({
      success: true,
      synced,
      store_id:
        String(store._id)
    })
  } catch (error) {
    console.error(
      "WooCommerce product sync error:",
      error
    )

    return res.status(500).json({
      success: false,
      error:
        "Failed to synchronize WooCommerce products",
      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message
    })
  }
}

/*
================================
GENERATE WOOCOMMERCE PLUGIN TOKEN
================================

POST /api/integrations/woocommerce/plugin/token

Authenticated merchant generates a
short-lived installation token.

The merchant JWT never goes into
WordPress.

================================
*/

async function generateWooCommercePluginToken(
  req,
  res
) {
  try {
    /*
    --------------------------------
    AUTHENTICATED MERCHANT
    --------------------------------
    */

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error:
          "Authentication required"
      })
    }

    /*
    --------------------------------
    INVALIDATE PREVIOUS TOKENS
    --------------------------------
    */

    await IntegrationToken.updateMany(
      {
        merchant_id:
          req.user.id,
        type:
          "woocommerce",
        used: false
      },
      {
        $set: {
          used: true,
          used_at:
            new Date()
        }
      }
    )

    /*
    --------------------------------
    GENERATE TOKEN
    --------------------------------
    */

    const rawToken =
      crypto
        .randomBytes(32)
        .toString("hex")

    /*
    --------------------------------
    HASH TOKEN
    --------------------------------
    */

    const tokenHash =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          rawToken
        )
        .digest(
          "hex"
        )

    /*
    --------------------------------
    EXPIRATION
    --------------------------------
    */

    const expiresAt =
      new Date(
        Date.now() +
        15 * 60 * 1000
      )

    /*
    --------------------------------
    SAVE TOKEN
    --------------------------------
    */

    await IntegrationToken.create({
      merchant_id:
        req.user.id,
      type:
        "woocommerce",
      token_hash:
        tokenHash,
      expires_at:
        expiresAt
    })

    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({
      success: true,
      token: rawToken,
      expires_at:
        expiresAt
    })
  } catch (error) {
    console.error(
      "Generate WooCommerce plugin token error:",
      error
    )

    return res.status(500).json({
      success: false,
      error:
        "Failed to generate WooCommerce connection token"
    })
  }
}

/*
================================
CONNECT WOOCOMMERCE PLUGIN
================================

POST /api/integrations/woocommerce/plugin/connect

The WooCommerce plugin sends:

token
store_url
store_name
consumer_key
consumer_secret

The temporary token identifies the
Merchant Platform merchant.

WooCommerce credentials are verified
before being stored.

A persistent plugin credential is
generated after successful connection.

The raw plugin credential is returned
once and only its SHA-256 hash is
stored on the Merchant Platform.

A unique webhook secret is generated
for this WooCommerce store.

================================
*/

async function connectWooCommercePlugin(
  req,
  res
) {
  try {
    /*
    --------------------------------
    REQUEST DATA
    --------------------------------
    */

    const {
      token,
      store_url,
      store_name,
      consumer_key,
      consumer_secret
    } = req.body

    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!token) {
      return res.status(400).json({
        success: false,
        error:
          "token is required"
      })
    }

    if (!store_url) {
      return res.status(400).json({
        success: false,
        error:
          "store_url is required"
      })
    }

    if (!consumer_key) {
      return res.status(400).json({
        success: false,
        error:
          "consumer_key is required"
      })
    }

    if (!consumer_secret) {
      return res.status(400).json({
        success: false,
        error:
          "consumer_secret is required"
      })
    }

    /*
    --------------------------------
    NORMALIZE URL
    --------------------------------
    */

    let normalizedStoreUrl

    try {
      const parsedUrl =
        new URL(
          String(
            store_url
          ).trim()
        )

      if (
        parsedUrl.protocol !==
          "http:" &&
        parsedUrl.protocol !==
          "https:"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid WooCommerce store URL"
        })
      }

      normalizedStoreUrl =
        parsedUrl
          .toString()
          .replace(
            /\/+$/,
            ""
          )
    } catch {
      return res.status(400).json({
        success: false,
        error:
          "Invalid WooCommerce store URL"
      })
    }

    /*
    --------------------------------
    HASH CONNECTION TOKEN
    --------------------------------
    */

    const tokenHash =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          String(token)
        )
        .digest(
          "hex"
        )

    /*
    --------------------------------
    FIND VALID TOKEN
    --------------------------------
    */

    const integrationToken =
      await IntegrationToken.findOne({
        token_hash:
          tokenHash,
        type:
          "woocommerce",
        used: false,
        expires_at: {
          $gt:
            new Date()
        }
      })

    if (!integrationToken) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid or expired WooCommerce connection token"
      })
    }

    /*
    --------------------------------
    MERCHANT
    --------------------------------
    */

    const merchantId =
      integrationToken.merchant_id

    /*
    --------------------------------
    VERIFY WOOCOMMERCE CREDENTIALS
    --------------------------------
    */

    let wooResponse

    try {
      wooResponse =
        await axios.get(
          `${normalizedStoreUrl}/wp-json/wc/v3/system_status`,
          {
            auth: {
              username:
                consumer_key,
              password:
                consumer_secret
            },
            timeout: 15000
          }
        )
    } catch (wooError) {
      console.error(
        "WooCommerce credential verification failed:",
        wooError.message
      )

      return res.status(400).json({
        success: false,
        error:
          "Unable to authenticate with WooCommerce"
      })
    }

    /*
    --------------------------------
    GET WOOCOMMERCE STORE CURRENCY
    --------------------------------

    The currency is retrieved directly
    from WooCommerce after credentials
    have been successfully verified.

    We do not trust the plugin/browser
    to tell us the store currency.

    --------------------------------
    */

    let currency = ""

    try {
      const currencyResponse =
        await axios.get(
          `${normalizedStoreUrl}/wp-json/wc/v3/settings/general`,
          {
            auth: {
              username:
                consumer_key,
              password:
                consumer_secret
            },
            timeout: 15000
          }
        )

      const settings =
        Array.isArray(
          currencyResponse?.data
        )
          ? currencyResponse.data
          : []

      const currencySetting =
        settings.find(
          setting =>
            setting?.id ===
            "woocommerce_currency"
        )

      currency =
        String(
          currencySetting?.value ||
          ""
        )
          .trim()
          .toUpperCase()
    } catch (currencyError) {
      console.error(
        "WooCommerce currency retrieval failed:",
        currencyError.message
      )
    }

    if (
      !/^[A-Z]{3}$/.test(
        currency
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Unable to determine WooCommerce store currency"
      })
    }

    /*
    --------------------------------
    FIND MERCHANT STORE
    --------------------------------
    */

    let store =
      await Store.findOne({
        merchant_id:
          merchantId,
        "woocommerce.store_url":
          normalizedStoreUrl
      })

    /*
    --------------------------------
    PREVENT CROSS-MERCHANT CLAIM
    --------------------------------
    */

    if (!store) {
      const existingStore =
        await Store.findOne({
          "woocommerce.store_url":
            normalizedStoreUrl
        })

      if (existingStore) {
        return res.status(409).json({
          success: false,
          error:
            "This WooCommerce store is already connected to another merchant"
        })
      }
    }

    /*
    --------------------------------
    GENERATE PERSISTENT PLUGIN
    CREDENTIAL

    This is separate from the
    short-lived connection token.

    The raw value is returned once.
    Only the SHA-256 hash is persisted.

    --------------------------------
    */

    const pluginCredential =
      `wcai_${crypto
        .randomBytes(32)
        .toString("hex")}`

    const pluginCredentialHash =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          pluginCredential
        )
        .digest(
          "hex"
        )

    /*
    --------------------------------
    GENERATE WEBHOOK SECRET

    Unique per WooCommerce store.

    --------------------------------
    */

    const webhookSecret =
      `whsec_${crypto
        .randomBytes(32)
        .toString("hex")}`

    /*
    --------------------------------
    CREATE STORE
    --------------------------------
    */

    if (!store) {
      store =
        await Store.create({
          merchant_id:
            merchantId,
          store_name:
            store_name ||
            normalizedStoreUrl,
          platform:
            "woocommerce",
          platform_connected:
            true,
          platform_connection_status:
            "connected",
          platform_sync_error:
            undefined,
          currency:
            currency,
          woocommerce: {
            store_url:
              normalizedStoreUrl,
            consumer_key:
              consumer_key,
            consumer_secret:
              consumer_secret,
            plugin_credential_hash:
              pluginCredentialHash,
            webhook_secret:
              webhookSecret,
            connected:
              true
          }
        })
    } else {
      /*
      --------------------------------
      UPDATE EXISTING STORE
      --------------------------------
      */

      if (store_name) {
        store.store_name =
          store_name
      }

      store.platform =
        "woocommerce"

      store.platform_connected =
        true

      store.platform_connection_status =
        "connected"

      store.platform_sync_error =
        undefined

      store.currency =
        currency

      store.woocommerce = {
        ...(store.woocommerce?.toObject
          ? store.woocommerce.toObject()
          : store.woocommerce || {}),
        store_url:
          normalizedStoreUrl,
        consumer_key:
          consumer_key,
        consumer_secret:
          consumer_secret,
        plugin_credential_hash:
          pluginCredentialHash,
        webhook_secret:
          webhookSecret,
        connected:
          true
      }

      await store.save()
    }

    /*
    --------------------------------
    CONSUME CONNECTION TOKEN
    --------------------------------
    */

    integrationToken.used =
      true

    integrationToken.used_at =
      new Date()

    await integrationToken.save()

    /*
    --------------------------------
    RESPONSE

    plugin_credential and webhook_secret
    are returned to the plugin once.

    They are NOT stored in plaintext
    on the Merchant Platform.

    --------------------------------
    */

    return res.json({
      success: true,
      message:
        "WooCommerce store connected successfully",
      store: {
        id:
          String(
            store._id
          ),
        store_name:
          store.store_name,
        platform:
          store.platform,
        platform_connected:
          store.platform_connected,
        platform_connection_status:
          store.platform_connection_status,
        currency:
          store.currency,
        woocommerce: {
          store_url:
            store
              .woocommerce
              ?.store_url,
          connected:
            store
              .woocommerce
              ?.connected
        }
      },
      plugin_credential:
        pluginCredential,
      webhook_secret:
        webhookSecret,
      woocommerce: {
        version:
          wooResponse
            ?.data
            ?.environment
            ?.version ||
          null,
        currency:
          currency
      }
    })
  } catch (error) {
    console.error(
      "WooCommerce plugin connection error:",
      error
    )

    return res.status(500).json({
      success: false,
      error:
        "Failed to connect WooCommerce store",
      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message
    })
  }
}

/*
================================
GENERATE WOOCOMMERCE CONVERSATION TOKEN
================================

POST /api/integrations/woocommerce/plugin/conversation-token

Authenticated using the persistent
WooCommerce plugin credential.

The returned token is short-lived and
is used by the customer-facing
conversation endpoint.

================================
*/

async function generateWooCommerceConversationToken(
  req,
  res
) {
  try {
    const store =
      req.woocommerceStore

    if (!store) {
      return res.status(401).json({
        success: false,
        error:
          "WooCommerce store authentication is required"
      })
    }

    /*
    --------------------------------
    VERIFY STORE
    --------------------------------
    */

    if (
      store.platform !==
        "woocommerce" ||
      !store.platform_connected ||
      !store.woocommerce?.connected
    ) {
      return res.status(400).json({
        success: false,
        error:
          "WooCommerce store is not connected"
      })
    }

    /*
    --------------------------------
    GENERATE TOKEN
    --------------------------------
    */

    const token =
      createCustomerConversationToken({
        storeId:
          String(
            store._id
          ),
        channel:
          "woocommerce"
      })

    /*
    --------------------------------
    TOKEN EXPIRATION

    customerConversationAuth currently
    accepts tokens for 10 minutes.

    --------------------------------
    */

    const expiresAt =
      new Date(
        Date.now() +
        10 * 60 * 1000
      )

    return res.json({
      success: true,
      token,
      expires_at:
        expiresAt,
      store_id:
        String(
          store._id
        ),
      channel:
        "woocommerce"
    })
  } catch (error) {
    console.error(
      "Generate WooCommerce conversation token error:",
      error
    )

    return res.status(500).json({
      success: false,
      error:
        "Failed to generate conversation token"
    })
  }
}

/*
================================
EXPORTS
================================
*/

module.exports = {
  getPayments,
  updatePayments,
  connectShopify,
  getShopifyStore,
  syncShopifyProductsController,
  generateWooCommerceConversationToken,
  connectWooCommerce,
  syncWooCommerceProductsController,
  generateWooCommercePluginToken,
  connectWooCommercePlugin
}