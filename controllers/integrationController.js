const axios = require("axios")
const Store = require("../models/store")

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

      stripe_enabled:
        !!store.stripe_public_key,

      stripe_public_key:
        store.stripe_public_key || "",

      paystack_enabled:
        !!store.paystack_public_key,

      paystack_public_key:
        store.paystack_public_key || ""

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


    if (
      stripe_public_key !== undefined
    ) {

      store.stripe_public_key =
        stripe_public_key

    }


    if (
      stripe_secret_key !== undefined
    ) {

      store.stripe_secret_key =
        stripe_secret_key

    }


    if (
      paystack_public_key !== undefined
    ) {

      store.paystack_public_key =
        paystack_public_key

    }


    if (
      paystack_secret_key !== undefined
    ) {

      store.paystack_secret_key =
        paystack_secret_key

    }


    await store.save()


    return res.json({
      message:
        "Payment settings updated"
    })

  } catch (error) {

    console.error(
      "Update payments error:",
      error
    )

    return res.status(500).json({
      error:
        "Unable to update payment settings"
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
      shop_domain,
      shop_id,
      shop_name,
      shop_email,
      access_token
    } = req.body


    if (!shop_domain) {

      return res.status(400).json({
        error:
          "shop_domain is required"
      })

    }


    if (!shop_id) {

      return res.status(400).json({
        error:
          "shop_id is required"
      })

    }


    if (!access_token) {

      return res.status(400).json({
        error:
          "access_token is required"
      })

    }


    /*
    --------------------------------
    CONNECT
    --------------------------------
    */

    const result =
      await connectShopifyStore({

        shopDomain:
          shop_domain,

        shopId:
          shop_id,

        shopName:
          shop_name,

        shopEmail:
          shop_email,

        accessToken:
          access_token

      })


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success: true,

      created:
        result.created,

      store: {

        id:
          result.store._id,

        store_name:
          result.store.store_name,

        platform:
          result.store.platform,

        platform_connected:
          result.store.platform_connected,

        platform_connection_status:
          result.store
            .platform_connection_status,

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
RESOLVE SHOPIFY STORE
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
        error:
          "Unauthorized platform request"
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
        error:
          "shop is required"
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

        platform:
          "shopify",

        platform_connected:
          true,

        "shopify.connected":
          true

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

        error:
          "shop is required"

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

        platform:
          "shopify",

        platform_connected:
          true,

        "shopify.connected":
          true

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

      synced:
        result.synced,

      store_id:
        String(
          store._id
        )

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

    const store =
      req.store


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

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

    const normalizedStoreUrl =
      String(store_url)
        .trim()
        .replace(/\/+$/, "")


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

          timeout:
            15000

        }

      )


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


    store.woocommerce = {

      ...(store.woocommerce?.toObject
        ? store.woocommerce.toObject()
        : store.woocommerce || {}),

      store_url:
        normalizedStoreUrl,

      consumer_key,

      consumer_secret,

      connected:
        true

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

        woocommerce: {

          store_url:
            store.woocommerce.store_url,

          connected:
            store.woocommerce.connected

        }

      },

      woocommerce: {

        version:
          response.data?.environment?.version ||
          null

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


        if (
          store.woocommerce
        ) {

          store.woocommerce.connected =
            false

        }


        await store.save()

      }

    } catch (
      stateError
    ) {

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
      status && status >= 400 && status < 500
        ? status
        : 500
    ).json({

      success: false,

      error:
        "Failed to connect WooCommerce store",

      details:
        process.env.NODE_ENV === "production"
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

    const store =
      req.store


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

      })

    }


    /*
    --------------------------------
    USE SAVED CONNECTION
    --------------------------------
    */

    const storeUrl =
      store.woocommerce?.store_url

    const consumerKey =
      store.woocommerce?.consumer_key

    const consumerSecret =
      store.woocommerce?.consumer_secret


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
        String(
          store._id
        )

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
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message

    })

  }

}


module.exports = {

  getPayments,

  updatePayments,

  connectShopify,

  getShopifyStore,

  syncShopifyProductsController,

  connectWooCommerce,

  syncWooCommerceProductsController

}