const crypto = require("crypto")

const Store = require("../models/store")
const Product = require("../models/product")
const Order = require("../models/order")


const {
  syncShopifyCustomer,
  deleteShopifyCustomer
} = require("../services/shopifyCustomerService")


const {
  syncShopifyOrder,
  deleteShopifyOrder
} = require("../services/shopifyOrderService")

const {
  syncWooProduct
} =
  require("../services/woocommerceService")

/*
================================
HELPER: ADD 1 YEAR
================================
*/

function addOneYear() {

  return new Date(
    Date.now() +
    (
      365 *
      24 *
      60 *
      60 *
      1000
    )
  )

}



/*
================================
SHOPIFY HMAC
================================
*/

function verifyShopifyWebhook(
  req
) {

  const secret =
    process.env.SHOPIFY_API_SECRET


  if (!secret) {

    throw new Error(
      "SHOPIFY_API_SECRET is not configured"
    )

  }


  const receivedHmac =
    req.headers[
      "x-shopify-hmac-sha256"
    ]


  if (!receivedHmac) {

    return false

  }


  const rawBody =
    Buffer.isBuffer(
      req.body
    )
      ? req.body
      : Buffer.from("")


  const digest =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        rawBody
      )
      .digest(
        "base64"
      )


  const received =
    Buffer.from(
      String(
        receivedHmac
      ),
      "utf8"
    )


  const expected =
    Buffer.from(
      digest,
      "utf8"
    )


  if (
    received.length !==
    expected.length
  ) {

    return false

  }


  return crypto.timingSafeEqual(
    received,
    expected
  )

}



/*
================================
SHOPIFY BODY
================================
*/

function parseShopifyBody(
  req
) {

  if (
    Buffer.isBuffer(
      req.body
    )
  ) {

    return JSON.parse(
      req.body.toString(
        "utf8"
      )
    )

  }


  return req.body

}



/*
================================
FIND SHOPIFY STORE
================================
*/

async function findShopifyStore(
  req
) {

  const shopDomain =
    String(
      req.headers[
        "x-shopify-shop-domain"
      ] ||
      ""
    )
      .trim()
      .toLowerCase()


  if (!shopDomain) {

    return null

  }


  return Store.findOne({

    "shopify.shop_domain":
      shopDomain,

    platform:
      "shopify",

    platform_connected:
      true,

    "shopify.connected":
      true

  })

}



/*
================================
NORMALIZE SHOPIFY PRODUCT
================================
*/

function normalizeShopifyProduct(
  product,
  store
) {

  const productId =
    product.id


  const title =
    product.title ||
    ""


  const description =
    product.body_html ||
    product.body ||
    product.description ||
    ""


  const handle =
    product.handle ||
    ""


  /*
  --------------------------------
  PRICE
  --------------------------------
  */

  const variants =
    Array.isArray(
      product.variants
    )
      ? product.variants
      : []


  const numericPrices =
    variants
      .map(
        variant =>
          Number(
            variant.price
          )
      )
      .filter(
        price =>
          Number.isFinite(
            price
          )
      )


  const price =
    numericPrices.length
      ? Math.min(
          ...numericPrices
        )
      : 0


  /*
  --------------------------------
  INVENTORY
  --------------------------------
  */

  const stock =
    variants.reduce(
      (
        total,
        variant
      ) => {

        const quantity =
          Number(
            variant.inventory_quantity
          )


        return (
          total +
          (
            Number.isFinite(
              quantity
            )
              ? quantity
              : 0
          )
        )

      },
      0
    )


  /*
  --------------------------------
  IMAGES
  --------------------------------
  */

  const images =
    Array.isArray(
      product.images
    )
      ? product.images
          .map(
            image =>
              image?.src
          )
          .filter(Boolean)
      : []


  if (
    !images.length &&
    product.image?.src
  ) {

    images.push(
      product.image.src
    )

  }


  /*
  --------------------------------
  PRODUCT URL
  --------------------------------
  */

  const shopDomain =
    store.shopify?.shop_domain


  const productUrl =
    handle &&
    shopDomain
      ? `https://${shopDomain}/products/${handle}`
      : ""


  /*
  --------------------------------
  VARIANTS
  --------------------------------
  */

  const normalizedVariants =
    variants.map(
      variant => {

        const attributes = {}


        if (
          variant.option1
        ) {

          attributes.option1 =
            variant.option1

        }


        if (
          variant.option2
        ) {

          attributes.option2 =
            variant.option2

        }


        if (
          variant.option3
        ) {

          attributes.option3 =
            variant.option3

        }


        const variantStock =
          Number(
            variant.inventory_quantity
          )


        return {

          external_id:
            String(
              variant.id
            ),

          title:
            variant.title ||
            "",

          sku:
            variant.sku ||
            "",

          price:
            Number(
              variant.price
            ) || 0,

          stock:
            Number.isFinite(
              variantStock
            )
              ? variantStock
              : 0,

          available:
            variant.inventory_management
              ? (
                  Number.isFinite(
                    variantStock
                  )
                    ? variantStock > 0
                    : false
                )
              : true,

          attributes

        }

      }
    )


  return {

    store_id:
      store._id,

    external_id:
      String(
        productId
      ),

    name:
      title,

    description,

    currency:
      "USD",

    price,

    stock,

    images,

    product_url:
      productUrl,

    variants:
      normalizedVariants,

    source:
      "shopify"

  }

}



/*
================================
SHOPIFY PRODUCT CREATE
================================
*/

async function handleShopifyProductCreate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      console.log(
        "Shopify store not found:",
        req.headers[
          "x-shopify-shop-domain"
        ]
      )

      return res.json({
        received: true
      })

    }


    const product =
      parseShopifyBody(
        req
      )


    if (!product?.id) {

      return res.status(400).json({

        error:
          "Shopify product ID missing"

      })

    }


    const normalized =
      normalizeShopifyProduct(
        product,
        store
      )


    await Product.findOneAndUpdate(

      {

        store_id:
          store._id,

        source:
          "shopify",

        external_id:
          normalized.external_id

      },

      {

        $set:
          normalized

      },

      {

        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true

      }

    )


    const now =
      new Date()


    store.platform_last_sync =
      now


    store.platform_sync_error =
      undefined


    if (
      store.shopify
    ) {

      store.shopify.last_product_sync =
        now

    }


    await store.save()


    console.log(
      "Shopify product created:",
      normalized.external_id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify product create webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify product webhook failed"

    })

  }

}



/*
================================
SHOPIFY PRODUCT UPDATE
================================
*/

async function handleShopifyProductUpdate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const product =
      parseShopifyBody(
        req
      )


    if (!product?.id) {

      return res.status(400).json({

        error:
          "Shopify product ID missing"

      })

    }


    const normalized =
      normalizeShopifyProduct(
        product,
        store
      )


    await Product.findOneAndUpdate(

      {

        store_id:
          store._id,

        source:
          "shopify",

        external_id:
          normalized.external_id

      },

      {

        $set:
          normalized

      },

      {

        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true

      }

    )


    const now =
      new Date()


    store.platform_last_sync =
      now


    store.platform_sync_error =
      undefined


    if (
      store.shopify
    ) {

      store.shopify.last_product_sync =
        now

    }


    await store.save()


    console.log(
      "Shopify product updated:",
      normalized.external_id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify product update webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify product webhook failed"

    })

  }

}



/*
================================
SHOPIFY PRODUCT DELETE
================================
*/

async function handleShopifyProductDelete(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const product =
      parseShopifyBody(
        req
      )


    if (!product?.id) {

      return res.status(400).json({

        error:
          "Shopify product ID missing"

      })

    }


    await Product.deleteOne({

      store_id:
        store._id,

      source:
        "shopify",

      external_id:
        String(
          product.id
        )

    })


    const now =
      new Date()


    store.platform_last_sync =
      now


    if (
      store.shopify
    ) {

      store.shopify.last_product_sync =
        now

    }


    await store.save()


    console.log(
      "Shopify product deleted:",
      product.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify product delete webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify product webhook failed"

    })

  }

}



/*
================================
SHOPIFY CUSTOMER CREATE
================================
*/

async function handleShopifyCustomerCreate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const customer =
      parseShopifyBody(
        req
      )


    if (!customer?.id) {

      return res.status(400).json({

        error:
          "Shopify customer ID missing"

      })

    }


    await syncShopifyCustomer({

      store,

      customer

    })


    console.log(
      "Shopify customer created:",
      customer.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify customer create webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify customer webhook failed"

    })

  }

}



/*
================================
SHOPIFY CUSTOMER UPDATE
================================
*/

async function handleShopifyCustomerUpdate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const customer =
      parseShopifyBody(
        req
      )


    if (!customer?.id) {

      return res.status(400).json({

        error:
          "Shopify customer ID missing"

      })

    }


    await syncShopifyCustomer({

      store,

      customer

    })


    console.log(
      "Shopify customer updated:",
      customer.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify customer update webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify customer webhook failed"

    })

  }

}



/*
================================
SHOPIFY CUSTOMER DELETE
================================
*/

async function handleShopifyCustomerDelete(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const customer =
      parseShopifyBody(
        req
      )


    if (!customer?.id) {

      return res.status(400).json({

        error:
          "Shopify customer ID missing"

      })

    }


    await deleteShopifyCustomer({

      store,

      externalId:
        customer.id

    })


    console.log(
      "Shopify customer deleted:",
      customer.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify customer delete webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify customer webhook failed"

    })

  }

}



/*
================================
SHOPIFY ORDER CREATE
================================
*/

async function handleShopifyOrderCreate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const order =
      parseShopifyBody(
        req
      )


    if (!order?.id) {

      return res.status(400).json({

        error:
          "Shopify order ID missing"

      })

    }


    await syncShopifyOrder({

      store,

      order

    })


    console.log(
      "Shopify order created:",
      order.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify order create webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify order webhook failed"

    })

  }

}



/*
================================
SHOPIFY ORDER UPDATE
================================
*/

async function handleShopifyOrderUpdate(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const order =
      parseShopifyBody(
        req
      )


    if (!order?.id) {

      return res.status(400).json({

        error:
          "Shopify order ID missing"

      })

    }


    await syncShopifyOrder({

      store,

      order

    })


    console.log(
      "Shopify order updated:",
      order.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify order update webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify order webhook failed"

    })

  }

}



/*
================================
SHOPIFY ORDER CANCELLED
================================
*/

async function handleShopifyOrderCancelled(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const order =
      parseShopifyBody(
        req
      )


    if (!order?.id) {

      return res.status(400).json({

        error:
          "Shopify order ID missing"

      })

    }


    await syncShopifyOrder({

      store,

      order

    })


    console.log(
      "Shopify order cancelled:",
      order.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify order cancelled webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify order webhook failed"

    })

  }

}



/*
================================
SHOPIFY ORDER DELETE
================================
*/

async function handleShopifyOrderDelete(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (!store) {

      return res.json({
        received: true
      })

    }


    const order =
      parseShopifyBody(
        req
      )


    if (!order?.id) {

      return res.status(400).json({

        error:
          "Shopify order ID missing"

      })

    }


    await deleteShopifyOrder({

      store,

      externalId:
        order.id

    })


    console.log(
      "Shopify order deleted:",
      order.id
    )


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify order delete webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify order delete webhook failed"

    })

  }

}



/*
================================
SHOPIFY APP UNINSTALLED
================================
*/

async function handleShopifyAppUninstalled(
  req,
  res
) {

  try {

    const store =
      await findShopifyStore(
        req
      )


    if (store) {

      store.platform_connected =
        false

      store.platform_connection_status =
        "disconnected"

      store.platform_sync_error =
        undefined


      if (
        store.shopify
      ) {

        store.shopify.connected =
          false

      }


      await store.save()


      console.log(
        "Shopify app uninstalled:",
        store.shopify?.shop_domain
      )

    }


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Shopify uninstall webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify uninstall webhook failed"

    })

  }

}



/*
================================
SHOPIFY WEBHOOK DISPATCHER
================================
*/

async function handleShopifyWebhook(
  req,
  res
) {

  try {

    if (
      !verifyShopifyWebhook(
        req
      )
    ) {

      console.log(
        "Invalid Shopify webhook signature"
      )

      return res.status(401).send(
        "Invalid signature"
      )

    }


    const topic =
      String(
        req.headers[
          "x-shopify-topic"
        ] ||
        ""
      )
        .toLowerCase()


    switch (topic) {

      case "products/create":

        return handleShopifyProductCreate(
          req,
          res
        )


      case "products/update":

        return handleShopifyProductUpdate(
          req,
          res
        )


      case "products/delete":

        return handleShopifyProductDelete(
          req,
          res
        )


      case "customers/create":

        return handleShopifyCustomerCreate(
          req,
          res
        )


      case "customers/update":

        return handleShopifyCustomerUpdate(
          req,
          res
        )


      case "customers/delete":

        return handleShopifyCustomerDelete(
          req,
          res
        )


      case "orders/create":

        return handleShopifyOrderCreate(
          req,
          res
        )


      case "orders/updated":

        return handleShopifyOrderUpdate(
          req,
          res
        )


      case "orders/cancelled":

        return handleShopifyOrderCancelled(
          req,
          res
        )


      case "orders/delete":

        return handleShopifyOrderDelete(
          req,
          res
        )


      case "app/uninstalled":

        return handleShopifyAppUninstalled(
          req,
          res
        )


      default:

        console.log(
          "Unhandled Shopify webhook:",
          topic
        )

        return res.json({
          received: true
        })

    }

  } catch (error) {

    console.error(
      "Shopify webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Shopify webhook processing failed"

    })

  }

}



/*
================================
WOOCOMMERCE BODY
================================
*/

function parseWooCommerceBody(
  req
) {

  if (
    Buffer.isBuffer(
      req.body
    )
  ) {

    return JSON.parse(
      req.body.toString(
        "utf8"
      )
    )

  }


  return req.body

}



/*
================================
FIND WOOCOMMERCE STORE
================================
*/

async function findWooCommerceStore(
  req
) {

  const source =
    String(
      req.headers[
        "x-wc-webhook-source"
      ] ||
      ""
    )
      .trim()
      .toLowerCase()


  if (!source) {

    return null

  }


  /*
  --------------------------------
  NORMALIZE SOURCE URL
  --------------------------------
  */

  const normalizedSource =
    source.replace(
      /\/+$/,
      ""
    )


  /*
  --------------------------------
  FIND STORE
  --------------------------------
  */

  const stores =
    await Store.find({

      platform:
        "woocommerce",

      platform_connected:
        true,

      "woocommerce.connected":
        true

    })


  /*
  --------------------------------
  MATCH URL
  --------------------------------
  */

  for (
    const store
    of stores
  ) {

    const storeUrl =
      String(
        store.woocommerce?.store_url ||
        ""
      )
        .trim()
        .replace(
          /\/+$/,
          ""
        )
        .toLowerCase()


    if (
      storeUrl &&
      storeUrl ===
        normalizedSource
    ) {

      return store

    }

  }


  return null

}



/*
================================
VERIFY WOOCOMMERCE WEBHOOK
================================
*/

function verifyWooCommerceWebhook(
  req,
  store
) {

  const secret =
    store
      ?.woocommerce
      ?.webhook_secret


  if (!secret) {

    console.error(
      "WooCommerce webhook secret is missing"
    )

    return false

  }


  const receivedSignature =
    req.headers[
      "x-wc-webhook-signature"
    ]


  if (
    !receivedSignature
  ) {

    return false

  }


  /*
  --------------------------------
  ORIGINAL RAW BODY
  --------------------------------
  */

  const rawBody =
    Buffer.isBuffer(
      req.body
    )
      ? req.body
      : Buffer.from("")


  /*
  --------------------------------
  HMAC SHA256
  --------------------------------
  */

  const digest =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        rawBody
      )
      .digest(
        "base64"
      )


  const received =
    Buffer.from(
      String(
        receivedSignature
      ),
      "utf8"
    )


  const expected =
    Buffer.from(
      digest,
      "utf8"
    )


  if (
    received.length !==
    expected.length
  ) {

    return false

  }


  return crypto.timingSafeEqual(
    received,
    expected
  )

}



/*
================================
NORMALIZE WOOCOMMERCE PRODUCT
================================
*/

function normalizeWooCommerceProduct(
  product,
  store
) {

  const variations =
    Array.isArray(
      product.variations
    )
      ? product.variations
      : []


  const numericPrices =
    variations
      .map(
        variant =>
          Number(
            variant.price
          )
      )
      .filter(
        price =>
          Number.isFinite(
            price
          )
      )


  const price =
    numericPrices.length
      ? Math.min(
          ...numericPrices
        )
      : (
          Number(
            product.price
          ) || 0
        )


  /*
  --------------------------------
  STOCK
  --------------------------------
  */

  let stock =
    Number(
      product.stock_quantity
    )


  if (
    !Number.isFinite(
      stock
    )
  ) {

    stock = 0

  }


  /*
  --------------------------------
  VARIANT STOCK
  --------------------------------
  */

  if (
    variations.length
  ) {

    stock =
      variations.reduce(

        (
          total,
          variant
        ) => {

          const quantity =
            Number(
              variant.stock_quantity
            )


          return (
            total +
            (
              Number.isFinite(
                quantity
              )
                ? quantity
                : 0
            )
          )

        },

        0

      )

  }


  /*
  --------------------------------
  IMAGES
  --------------------------------
  */

  const images =
    Array.isArray(
      product.images
    )

      ? product.images
          .map(
            image =>
              image?.src
          )
          .filter(Boolean)

      : []


  /*
  --------------------------------
  VARIANTS
  --------------------------------
  */

  const normalizedVariants =
    variations.map(
      variant => {

        const attributes = {}


        if (
          Array.isArray(
            variant.attributes
          )
        ) {

          for (
            const attribute
            of variant.attributes
          ) {

            if (
              attribute.name
            ) {

              attributes[
                attribute.name
              ] =
                attribute.option ||
                ""

            }

          }

        }


        const variantStock =
          Number(
            variant.stock_quantity
          )


        return {

          external_id:
            String(
              variant.id
            ),

          title:
            variant.name ||
            "",

          sku:
            variant.sku ||
            "",

          price:
            Number(
              variant.price
            ) || 0,

          stock:
            Number.isFinite(
              variantStock
            )
              ? variantStock
              : 0,

          available:
            variant.stock_status ===
              "instock" ||
            !variant.manage_stock,

          attributes

        }

      }
    )


  return {

    store_id:
      store._id,

    external_id:
      String(
        product.id
      ),

    name:
      product.name ||
      "",

    description:
      product.description ||
      "",

    price,

    currency:
      product.currency ||
      "USD",

    stock,

    images,

    product_url:
      product.permalink ||
      "",

    variants:
      normalizedVariants,

    source:
      "woocommerce"

  }

}



/*
================================
UPDATE WOOCOMMERCE SYNC TIME
================================
*/

async function updateWooProductSyncTime(
  store
) {

  const now =
    new Date()


  store.platform_last_sync =
    now


  store.platform_sync_error =
    undefined


  if (
    store.woocommerce
  ) {

    store.woocommerce.last_product_sync =
      now

  }


  await store.save()

}



/*
================================
UPDATE WOOCOMMERCE ORDER SYNC TIME
================================
*/

async function updateWooOrderSyncTime(
  store
) {

  const now =
    new Date()


  store.platform_last_sync =
    now


  store.platform_sync_error =
    undefined


  if (
    store.woocommerce
  ) {

    store.woocommerce.last_order_sync =
      now

  }


  await store.save()

}



/*
================================
WOOCOMMERCE PRODUCT CREATE
================================
*/

async function handleWooCommerceProductCreate(
  req,
  res,
  store
) {

  const product =
    parseWooCommerceBody(
      req
    )


  if (
    !product?.id
  ) {

    return res.status(400).json({

      error:
        "WooCommerce product ID missing"

    })

  }


  /*
  --------------------------------
  FETCH + NORMALIZE + UPSERT
  --------------------------------
  */

  const result =
    await syncWooProduct(

      store,

      product.id

    )


  /*
  --------------------------------
  PRODUCT DELETED
  --------------------------------

  This can happen if WooCommerce
  sends an update for a product that
  was removed before our API fetch.
  --------------------------------
  */

  if (
    result.deleted
  ) {

    await Product.deleteOne({

      store_id:
        store._id,

      source:
        "woocommerce",

      external_id:
        String(
          product.id
        )

    })


    await updateWooProductSyncTime(
      store
    )


    console.log(
      "WooCommerce product removed:",
      product.id
    )


    return res.json({

      received:
        true,

      deleted:
        true

    })

  }


  /*
  --------------------------------
  UPDATE SYNC TIME
  --------------------------------
  */

  await updateWooProductSyncTime(
    store
  )


  console.log(

    "WooCommerce product synchronized:",

    result.product.external_id

  )


  return res.json({

    received:
      true,

    product_id:
      result.product.external_id

  })

}



/*
================================
WOOCOMMERCE PRODUCT UPDATE
================================
*/

async function handleWooCommerceProductUpdate(
  req,
  res,
  store
) {

  return handleWooCommerceProductCreate(
    req,
    res,
    store
  )

}



/*
================================
WOOCOMMERCE PRODUCT DELETE
================================
*/

async function handleWooCommerceProductDelete(
  req,
  res,
  store
) {

  const product =
    parseWooCommerceBody(
      req
    )


  if (
    !product?.id
  ) {

    return res.status(400).json({

      error:
        "WooCommerce product ID missing"

    })

  }


  await Product.deleteOne({

    store_id:
      store._id,

    source:
      "woocommerce",

    external_id:
      String(
        product.id
      )

  })


  await updateWooProductSyncTime(
    store
  )


  console.log(
    "WooCommerce product deleted:",
    product.id
  )


  return res.json({
    received: true
  })

}



/*
================================
NORMALIZE WOOCOMMERCE ORDER
================================
*/

function normalizeWooCommerceOrder(
  wooOrder,
  store
) {

  const lineItems =
    Array.isArray(
      wooOrder.line_items
    )
      ? wooOrder.line_items
      : []


  const items =
    lineItems.map(
      item => {

        const itemTotal =
          Number(
            item.total
          ) || 0


        const quantity =
          Number(
            item.quantity
          ) || 1


        const unitPrice =
          Number(
            item.price
          )


        return {

          external_product_id:
            item.product_id
              ? String(
                  item.product_id
                )
              : "",

          external_variant_id:
            item.variation_id
              ? String(
                  item.variation_id
                )
              : "",

          name:
            item.name ||
            "",

          sku:
            item.sku ||
            "",

          quantity,

          unit_price:
            Number.isFinite(
              unitPrice
            )
              ? unitPrice
              : (
                  itemTotal /
                  quantity
                ),

          total_price:
            itemTotal

        }

      }
    )


  const billing =
    wooOrder.billing ||
    {}


  /*
  --------------------------------
  ORDER STATUS
  --------------------------------
  */

  let orderStatus =
    "new"


  if (
    wooOrder.status ===
      "processing" ||
    wooOrder.status ===
      "on-hold"
  ) {

    orderStatus =
      "paid"

  }


  if (
    wooOrder.status ===
    "completed"
  ) {

    orderStatus =
      "completed"

  }


  if (
    wooOrder.status ===
      "cancelled" ||
    wooOrder.status ===
      "refunded"
  ) {

    orderStatus =
      "cancelled"

  }


  /*
  --------------------------------
  PAYMENT STATUS
  --------------------------------
  */

  let paymentStatus =
    "pending"


  if (
    wooOrder.status ===
      "processing" ||
    wooOrder.status ===
      "completed"
  ) {

    paymentStatus =
      "paid"

  }


  if (
    wooOrder.status ===
    "refunded"
  ) {

    paymentStatus =
      "refunded"

  }


  if (
    wooOrder.status ===
    "cancelled"
  ) {

    paymentStatus =
      "cancelled"

  }


  /*
  --------------------------------
  CUSTOMER NAME
  --------------------------------
  */

  const customerName =
    [
      billing.first_name,
      billing.last_name
    ]
      .filter(Boolean)
      .join(" ")


  /*
  --------------------------------
  CUSTOMER ADDRESS
  --------------------------------
  */

  const customerAddress =
    [
      billing.address_1,
      billing.address_2,
      billing.city,
      billing.state,
      billing.postcode,
      billing.country
    ]
      .filter(Boolean)
      .join(", ")


  /*
  --------------------------------
  RETURN NORMALIZED ORDER
  --------------------------------
  */

  return {

    store_id:
      store._id,

    external_id:
      String(
        wooOrder.id
      ),

    source:
      "woocommerce",

    order_number:
      wooOrder.number ||
      String(
        wooOrder.id
      ),

    external_customer_id:
      wooOrder.customer_id
        ? String(
            wooOrder.customer_id
          )
        : "",

    customer_name:
      customerName,

    customer_email:
      billing.email ||
      "",

    customer_phone:
      billing.phone ||
      "",

    customer_address:
      customerAddress,

    items,

    subtotal:
      Number(
        wooOrder.subtotal
      ) ||
      Number(
        wooOrder.total
      ) ||
      0,

    total_price:
      Number(
        wooOrder.total
      ) || 0,

    currency:
      wooOrder.currency ||
      "USD",

    payment_reference:
      wooOrder.transaction_id ||
      "",

    payment_status:
      paymentStatus,

    order_status:
      orderStatus,

    ordered_at:
      wooOrder.date_created
        ? new Date(
            wooOrder.date_created
          )
        : new Date(),

    fulfilled_at:
      wooOrder.date_completed
        ? new Date(
            wooOrder.date_completed
          )
        : undefined,

    cancelled_at:
      wooOrder.date_cancelled
        ? new Date(
            wooOrder.date_cancelled
          )
        : undefined

  }

}



/*
================================
WOOCOMMERCE ORDER CREATE
================================
*/

async function handleWooCommerceOrderCreate(
  req,
  res,
  store
) {

  const wooOrder =
    parseWooCommerceBody(
      req
    )


  if (
    !wooOrder?.id
  ) {

    return res.status(400).json({

      error:
        "WooCommerce order ID missing"

    })

  }


  const normalized =
    normalizeWooCommerceOrder(
      wooOrder,
      store
    )


  await Order.findOneAndUpdate(

    {

      store_id:
        store._id,

      source:
        "woocommerce",

      external_id:
        normalized.external_id

    },

    {

      $set:
        normalized

    },

    {

      upsert:
        true,

      new:
        true,

      setDefaultsOnInsert:
        true

    }

  )


  await updateWooOrderSyncTime(
    store
  )


  console.log(
    "WooCommerce order created:",
    normalized.external_id
  )


  return res.json({
    received: true
  })

}



/*
================================
WOOCOMMERCE ORDER UPDATE
================================
*/

async function handleWooCommerceOrderUpdate(
  req,
  res,
  store
) {

  return handleWooCommerceOrderCreate(
    req,
    res,
    store
  )

}



/*
================================
WOOCOMMERCE ORDER DELETE
================================
*/

async function handleWooCommerceOrderDelete(
  req,
  res,
  store
) {

  const wooOrder =
    parseWooCommerceBody(
      req
    )


  if (
    !wooOrder?.id
  ) {

    return res.status(400).json({

      error:
        "WooCommerce order ID missing"

    })

  }


  await Order.deleteOne({

    store_id:
      store._id,

    source:
      "woocommerce",

    external_id:
      String(
        wooOrder.id
      )

  })


  await updateWooOrderSyncTime(
    store
  )


  console.log(
    "WooCommerce order deleted:",
    wooOrder.id
  )


  return res.json({
    received: true
  })

}



/*
================================
WOOCOMMERCE WEBHOOK DISPATCHER
================================
*/

async function handleWooCommerceWebhook(
  req,
  res
) {

  try {

    /*
    --------------------------------
    FIND STORE
    --------------------------------
    */

    const store =
      await findWooCommerceStore(
        req
      )


    if (!store) {

      console.log(
        "WooCommerce store not found:",
        req.headers[
          "x-wc-webhook-source"
        ]
      )

      /*
      --------------------------------
      ACK UNKNOWN STORE
      --------------------------------

      We acknowledge the webhook so
      WooCommerce does not endlessly
      retry a webhook for a store that
      has already disconnected.
      --------------------------------
      */

      return res.json({
        received: true
      })

    }


    /*
    --------------------------------
    VERIFY SIGNATURE
    --------------------------------
    */

    if (
      !verifyWooCommerceWebhook(
        req,
        store
      )
    ) {

      console.log(
        "Invalid WooCommerce webhook signature"
      )

      return res.status(401).send(
        "Invalid signature"
      )

    }


    /*
    --------------------------------
    TOPIC
    --------------------------------
    */

    const topic =
      String(
        req.headers[
          "x-wc-webhook-topic"
        ] ||
        ""
      )
        .trim()
        .toLowerCase()


    console.log(
      "WooCommerce webhook:",
      topic
    )


    /*
    --------------------------------
    DISPATCH
    --------------------------------
    */

    switch (topic) {

      case "product.created":

        return handleWooCommerceProductCreate(
          req,
          res,
          store
        )


      case "product.updated":

        return handleWooCommerceProductUpdate(
          req,
          res,
          store
        )


      case "product.deleted":

        return handleWooCommerceProductDelete(
          req,
          res,
          store
        )


      case "order.created":

        return handleWooCommerceOrderCreate(
          req,
          res,
          store
        )


      case "order.updated":

        return handleWooCommerceOrderUpdate(
          req,
          res,
          store
        )


      case "order.deleted":

        return handleWooCommerceOrderDelete(
          req,
          res,
          store
        )


      default:

        console.log(
          "Unhandled WooCommerce webhook:",
          topic
        )

        return res.json({
          received: true
        })

    }

  } catch (error) {

    console.error(
      "WooCommerce webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "WooCommerce webhook processing failed"

    })

  }

}



/*
================================
STRIPE WEBHOOK
================================
*/

async function handleStripeWebhook(
  req,
  res
) {

  try {

    const event =
      req.body


    console.log(
      "Stripe webhook:",
      event.type
    )


    if (
      event.type ===
      "checkout.session.completed"
    ) {

      const session =
        event.data.object


      const customerId =
        session.customer


      const plan =
        session.metadata?.plan ||
        "starter"


      const store =
        await Store.findOne({

          stripe_customer_id:
            customerId

        })


      if (!store) {

        console.log(
          "Store not found for Stripe customer:",
          customerId
        )

        return res.json({
          received: true
        })

      }


      store.plan =
        plan


      store.subscription_status =
        "active"


      store.subscription_renewal =
        addOneYear()


      await store.save()


      console.log(
        "Stripe subscription activated:",
        plan
      )

    }


    if (
      event.type ===
      "customer.subscription.deleted"
    ) {

      const subscription =
        event.data.object


      const store =
        await Store.findOne({

          stripe_customer_id:
            subscription.customer

        })


      if (store) {

        store.subscription_status =
          "cancelled"


        await store.save()


        console.log(
          "Stripe subscription cancelled"
        )

      }

    }


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Stripe webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Webhook processing failed"

    })

  }

}



/*
================================
PAYSTACK WEBHOOK
================================
*/

async function handlePaystackWebhook(
  req,
  res
) {

  try {

    const hash =
      crypto
        .createHmac(
          "sha512",
          process.env.PAYSTACK_SECRET
        )
        .update(
          JSON.stringify(
            req.body
          )
        )
        .digest(
          "hex"
        )


    if (
      hash !==
      req.headers[
        "x-paystack-signature"
      ]
    ) {

      console.log(
        "Invalid Paystack signature"
      )

      return res.status(401).send(
        "Invalid signature"
      )

    }


    const event =
      req.body


    console.log(
      "Paystack webhook:",
      event.event
    )


    if (
      event.event ===
      "charge.success"
    ) {

      const data =
        event.data


      const storeId =
        data.metadata?.store_id


      const plan =
        data.metadata?.plan ||
        "starter"


      if (!storeId) {

        console.log(
          "No store_id in metadata"
        )

        return res.json({
          received: true
        })

      }


      const store =
        await Store.findById(
          storeId
        )


      if (!store) {

        console.log(
          "Store not found:",
          storeId
        )

        return res.json({
          received: true
        })

      }


      store.plan =
        plan


      store.subscription_status =
        "active"


      store.subscription_renewal =
        addOneYear()


      await store.save()


      console.log(
        "Paystack subscription activated:",
        plan
      )

    }


    return res.json({
      received: true
    })

  } catch (error) {

    console.error(
      "Paystack webhook error:",
      error
    )

    return res.status(500).json({

      error:
        "Webhook processing failed"

    })

  }

}



/*
================================
MODULE EXPORTS
================================
*/

module.exports = {

  handleStripeWebhook,

  handlePaystackWebhook,

  handleShopifyWebhook,

  handleWooCommerceWebhook

}