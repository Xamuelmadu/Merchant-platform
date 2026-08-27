const crypto = require("crypto")

const Store = require("../models/store")
const Product = require("../models/product")

const {
  syncShopifyCustomer,
  deleteShopifyCustomer
} = require("../services/shopifyCustomerService")

const {
  syncShopifyOrder,
  deleteShopifyOrder
} = require("../services/shopifyOrderService")


/*
--------------------------------
HELPER: ADD 1 YEAR
--------------------------------
*/

function addOneYear() {
  return new Date(
    Date.now() +
    (365 * 24 * 60 * 60 * 1000)
  )
}


/*
--------------------------------
SHOPIFY HMAC
--------------------------------
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
    req.headers["x-shopify-hmac-sha256"]

  if (!receivedHmac) {
    return false
  }

  /*
  express.raw() gives us the original
  Buffer required for Shopify HMAC.
  */

  const rawBody =
    Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from("")


  const digest =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("base64")


  const received =
    Buffer.from(
      String(receivedHmac),
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
--------------------------------
SHOPIFY BODY
--------------------------------
*/

function parseShopifyBody(
  req
) {

  if (
    Buffer.isBuffer(req.body)
  ) {

    return JSON.parse(
      req.body.toString("utf8")
    )

  }

  return req.body

}


/*
--------------------------------
FIND SHOPIFY STORE
--------------------------------
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
--------------------------------
NORMALIZE SHOPIFY PRODUCT
--------------------------------
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

  Shopify webhook payloads expose
  variant prices rather than the
  Admin GraphQL priceRange object.
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
          Number.isFinite(price)
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


  /*
  --------------------------------
  FALLBACK IMAGE
  --------------------------------
  */

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
  VARIANT NORMALIZATION
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

    price,

    /*
    Shopify webhook product payloads
    do not reliably provide the shop
    currency.

    Keep the existing default rather
    than inventing a currency value.
    */

    currency:
      "USD",

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
        upsert: true,

        new: true,

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


    if (store.shopify) {

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
        upsert: true,

        new: true,

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


    if (store.shopify) {

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


    if (store.shopify) {

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


      if (store.shopify) {

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

    /*
    --------------------------------
    VERIFY HMAC
    --------------------------------
    */

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


    /*
    --------------------------------
    DISPATCH
    --------------------------------
    */

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
          JSON.stringify(req.body)
        )
        .digest("hex")


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


module.exports = {

  handleStripeWebhook,

  handlePaystackWebhook,

  handleShopifyWebhook

}