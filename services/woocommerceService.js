const axios = require("axios")
const Product = require("../models/product")


/*
================================
WOOCOMMERCE SERVICE
================================

Handles:

1. WooCommerce product sync
2. WooCommerce product variants
3. WooCommerce order creation

Canonical product identity:

store_id
+
source
+
external_id
================================
*/


/*
================================
NORMALIZE STORE URL
================================
*/

function normalizeStoreUrl(storeUrl) {

  if (!storeUrl) {
    throw new Error(
      "WooCommerce store URL is required"
    )
  }

  return String(storeUrl)
    .trim()
    .replace(/\/+$/, "")
}


/*
================================
CREATE WOOCOMMERCE CLIENT
================================
*/

function createWooClient(
  storeUrl,
  consumerKey,
  consumerSecret
) {

  return axios.create({

    baseURL:
      `${normalizeStoreUrl(storeUrl)}/wp-json/wc/v3`,

    timeout: 30000,

    auth: {
      username: consumerKey,
      password: consumerSecret
    },

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    }

  })
}


/*
================================
GET STORE CONFIG
================================
*/

function getWooConfig(store) {

  if (!store) {
    throw new Error(
      "Store is required"
    )
  }

  if (!store.woocommerce) {
    throw new Error(
      "WooCommerce configuration is missing"
    )
  }

  const {
    store_url,
    consumer_key,
    consumer_secret
  } = store.woocommerce

  if (!store_url) {
    throw new Error(
      "WooCommerce store URL is missing"
    )
  }

  if (!consumer_key) {
    throw new Error(
      "WooCommerce consumer key is missing"
    )
  }

  if (!consumer_secret) {
    throw new Error(
      "WooCommerce consumer secret is missing"
    )
  }

  return {
    storeUrl: normalizeStoreUrl(store_url),
    consumerKey: consumer_key,
    consumerSecret: consumer_secret
  }
}


/*
================================
NORMALIZE VARIANT
================================
*/

function normalizeWooVariant(
  variant
) {

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
          attribute.option || ""

      }

    }

  }

  const stock =
    variant.stock_quantity !== null &&
    variant.stock_quantity !== undefined

      ? Number(
          variant.stock_quantity
        )

      : 0


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

    stock,

    available:
      variant.stock_status === "instock" ||
      stock > 0,

    attributes

  }

}


/*
================================
FETCH PRODUCT VARIANTS
================================
*/

async function fetchWooVariants(
  client,
  product
) {

  if (
    !Array.isArray(
      product.variations
    ) ||
    !product.variations.length
  ) {

    return []

  }

  const variants = []

  let page = 1


  /*
  --------------------------------
  FETCH ALL VARIATIONS
  --------------------------------
  */

  while (true) {

    let response

    try {

      response =
        await client.get(

          `/products/${product.id}/variations`,

          {
            params: {
              per_page: 100,
              page
            }
          }

        )

    } catch (error) {

      const message =
        error.response?.data?.message ||
        error.message

      throw new Error(

        `Failed to fetch variations for WooCommerce product ${product.id}: ${message}`

      )

    }


    const pageVariants =
      Array.isArray(
        response.data
      )
        ? response.data
        : []


    if (
      !pageVariants.length
    ) {

      break

    }


    for (
      const variant
      of pageVariants
    ) {

      variants.push(
        normalizeWooVariant(
          variant
        )
      )

    }


    const totalPages =
      Number(
        response.headers[
          "x-wp-totalpages"
        ]
      ) || 1


    if (
      page >= totalPages
    ) {

      break

    }

    page++

  }


  return variants
}


/*
================================
NORMALIZE PRODUCT
================================
*/

async function normalizeWooProduct(
  client,
  product
) {

  const variants =
    await fetchWooVariants(
      client,
      product
    )


  /*
  --------------------------------
  PRODUCT STOCK
  --------------------------------
  */

  let stock = 0


  if (
    product.stock_quantity !== null &&
    product.stock_quantity !== undefined
  ) {

    stock =
      Number(
        product.stock_quantity
      ) || 0

  }


  /*
  --------------------------------
  VARIABLE PRODUCT STOCK
  --------------------------------
  */

  if (
    variants.length
  ) {

    stock =
      variants.reduce(

        (
          total,
          variant
        ) =>
          total +
          (
            Number(
              variant.stock
            ) || 0
          ),

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
              image.src
          )

          .filter(
            Boolean
          )

      : []


  /*
  --------------------------------
  PRICE
  --------------------------------
  */

  let price =
    Number(
      product.price
    ) || 0


  /*
  --------------------------------
  VARIABLE PRODUCT PRICE
  --------------------------------
  */

  if (
    variants.length
  ) {

    const prices =
      variants

        .map(
          variant =>
            Number(
              variant.price
            )
        )

        .filter(
          value =>
            Number.isFinite(
              value
            )
        )


    if (
      prices.length
    ) {

      price =
        Math.min(
          ...prices
        )

    }

  }


  return {

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

    variants,

    source:
      "woocommerce"

  }

}

/*
================================
SYNC SINGLE WOOCOMMERCE PRODUCT
================================

Used by WooCommerce webhooks.

The webhook payload may contain
variation IDs without the complete
variation objects.

Therefore we fetch the current
product from WooCommerce and then
fetch all of its variations.
================================
*/

async function syncWooProduct(
  store,
  productId
) {

  if (!store) {

    throw new Error(
      "Store is required"
    )

  }


  if (!productId) {

    throw new Error(
      "WooCommerce product ID is required"
    )

  }


  const {
    storeUrl,
    consumerKey,
    consumerSecret
  } =
    getWooConfig(
      store
    )


  const client =
    createWooClient(

      storeUrl,

      consumerKey,

      consumerSecret

    )


  /*
  --------------------------------
  FETCH CURRENT PRODUCT
  --------------------------------
  */

  let response

  try {

    response =
      await client.get(

        `/products/${encodeURIComponent(
          productId
        )}`

      )

  } catch (error) {

    const status =
      error.response?.status

    const message =
      error.response?.data?.message ||
      error.message


    if (
      status === 404
    ) {

      return {
        deleted: true,
        external_id:
          String(productId)
      }

    }


    throw new Error(

      `Failed to fetch WooCommerce product ${productId}: ${message}`

    )

  }


  const product =
    response.data


  if (
    !product ||
    !product.id
  ) {

    throw new Error(
      "WooCommerce returned an invalid product"
    )

  }


  /*
  --------------------------------
  NORMALIZE WITH FULL VARIATIONS
  --------------------------------
  */

  const normalized =
    await normalizeWooProduct(

      client,

      product

    )


  /*
  --------------------------------
  UPSERT CANONICAL PRODUCT
  --------------------------------
  */

  const saved =
    await Product.findOneAndUpdate(

      {

        store_id:
          store._id,

        source:
          "woocommerce",

        external_id:
          normalized.external_id

      },

      {

        $set: {

          store_id:
            store._id,

          external_id:
            normalized.external_id,

          name:
            normalized.name,

          description:
            normalized.description,

          price:
            normalized.price,

          currency:
            normalized.currency,

          stock:
            normalized.stock,

          images:
            normalized.images,

          product_url:
            normalized.product_url,

          variants:
            normalized.variants,

          source:
            "woocommerce"

        }

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


  return {

    deleted:
      false,

    product:
      saved

  }

}

/*
================================
SYNC WOOCOMMERCE PRODUCTS
================================
*/

async function syncWooProducts(

  storeId,

  storeUrl,

  consumerKey,

  consumerSecret

) {

  if (!storeId) {

    throw new Error(
      "storeId is required"
    )

  }

  if (!consumerKey) {

    throw new Error(
      "WooCommerce consumer key is required"
    )

  }

  if (!consumerSecret) {

    throw new Error(
      "WooCommerce consumer secret is required"
    )

  }


  const client =
    createWooClient(

      storeUrl,

      consumerKey,

      consumerSecret

    )


  let page = 1

  let processed = 0

  let created = 0

  let updated = 0


  /*
  --------------------------------
  FETCH PRODUCTS
  --------------------------------
  */

  while (true) {

    let response

    try {

      response =
        await client.get(

          "/products",

          {
            params: {

              per_page: 100,

              page

            }
          }

        )

    } catch (error) {

      const message =
        error.response?.data?.message ||
        error.message

      console.error(
        "WooCommerce product API error:",
        message
      )

      throw new Error(
        `WooCommerce product synchronization failed: ${message}`
      )

    }


    const products =
      Array.isArray(
        response.data
      )
        ? response.data
        : []


    if (
      !products.length
    ) {

      break

    }


    /*
    --------------------------------
    PROCESS PRODUCTS
    --------------------------------
    */

    for (
      const product
      of products
    ) {

      if (
        !product.id
      ) {

        continue

      }


      const normalized =
        await normalizeWooProduct(

          client,

          product

        )


      /*
      --------------------------------
      FIND EXISTING PRODUCT
      --------------------------------
      */

      const existing =
        await Product.findOne({

          store_id:
            storeId,

          source:
            "woocommerce",

          external_id:
            normalized.external_id

        })


      /*
      --------------------------------
      UPDATE
      --------------------------------
      */

      if (
        existing
      ) {

        existing.name =
          normalized.name

        existing.description =
          normalized.description

        existing.price =
          normalized.price

        existing.currency =
          normalized.currency

        existing.stock =
          normalized.stock

        existing.images =
          normalized.images

        existing.product_url =
          normalized.product_url

        existing.variants =
          normalized.variants

        await existing.save()

        updated++

      }


      /*
      --------------------------------
      CREATE
      --------------------------------
      */

      else {

        await Product.create({

          store_id:
            storeId,

          external_id:
            normalized.external_id,

          name:
            normalized.name,

          description:
            normalized.description,

          price:
            normalized.price,

          currency:
            normalized.currency,

          stock:
            normalized.stock,

          images:
            normalized.images,

          product_url:
            normalized.product_url,

          variants:
            normalized.variants,

          source:
            "woocommerce"

        })

        created++

      }


      processed++

    }


    /*
    --------------------------------
    PAGINATION
    --------------------------------
    */

    const totalPages =
      Number(
        response.headers[
          "x-wp-totalpages"
        ]
      ) || 1


    if (
      page >= totalPages
    ) {

      break

    }

    page++

  }


  console.log(

    `WooCommerce sync complete: ${processed} processed, ${created} created, ${updated} updated`

  )


  return {

    synced:
      processed,

    created,

    updated

  }

}


/*
================================
CREATE WOOCOMMERCE ORDER
================================
*/

async function createWooCommerceOrder({

  store,

  order

}) {

  if (!store) {

    throw new Error(
      "Store is required"
    )

  }

  if (!order) {

    throw new Error(
      "Order is required"
    )

  }


  const {
    storeUrl,
    consumerKey,
    consumerSecret
  } =
    getWooConfig(
      store
    )


  const client =
    createWooClient(

      storeUrl,

      consumerKey,

      consumerSecret

    )


  /*
  --------------------------------
  BUILD LINE ITEMS
  --------------------------------
  */

  const lineItems = []


  if (
    Array.isArray(
      order.items
    ) &&
    order.items.length
  ) {

    for (
      const item
      of order.items
    ) {

      let productId =
        item.external_product_id ||
        item.product_external_id ||
        ""


      let variationId =
        item.external_variant_id ||
        ""


      /*
      --------------------------------
      FALLBACK TO INTERNAL PRODUCT
      --------------------------------
      */

      if (
        !productId &&
        item.product_id
      ) {

        const product =
          await Product.findById(
            item.product_id
          )


        if (
          product
        ) {

          productId =
            product.external_id

        }

      }


      if (
        !productId
      ) {

        throw new Error(

          `WooCommerce product ID missing for ${item.name || "order item"}`

        )

      }


      const lineItem = {

        product_id:
          Number(
            productId
          ),

        quantity:
          Number(
            item.quantity
          ) || 1

      }


      /*
      --------------------------------
      VARIATION
      --------------------------------
      */

      if (
        variationId
      ) {

        lineItem.variation_id =
          Number(
            variationId
          )

      }


      lineItems.push(
        lineItem
      )

    }

  }


  /*
  --------------------------------
  LEGACY SINGLE PRODUCT
  --------------------------------
  */

  else if (
    order.product_id
  ) {

    const product =
      await Product.findById(
        order.product_id
      )


    if (
      !product
    ) {

      throw new Error(
        "Order product not found"
      )

    }


    if (
      !product.external_id
    ) {

      throw new Error(
        "WooCommerce product ID missing"
      )

    }


    lineItems.push({

      product_id:
        Number(
          product.external_id
        ),

      quantity:
        Number(
          order.quantity
        ) || 1

    })

  }


  if (
    !lineItems.length
  ) {

    throw new Error(
      "WooCommerce order contains no products"
    )

  }


  /*
  --------------------------------
  BILLING
  --------------------------------
  */

  const billing = {

    first_name:
      order.customer_name ||
      "Customer",

    last_name:
      "",

    email:
      order.customer_email ||
      "",

    phone:
      order.customer_phone ||
      "",

    address_1:
      order.customer_address ||
      "",

    address_2:
      "",

    city:
      "",

    state:
      "",

    postcode:
      "",

    country:
      ""

  }


  /*
  --------------------------------
  SHIPPING
  --------------------------------
  */

  const shipping = {

    first_name:
      order.customer_name ||
      "Customer",

    last_name:
      "",

    address_1:
      order.customer_address ||
      "",

    address_2:
      "",

    city:
      "",

    state:
      "",

    postcode:
      "",

    country:
      ""

  }


  /*
  --------------------------------
  WOOCOMMERCE ORDER PAYLOAD
  --------------------------------
  */

  const payload = {

    status:
      "pending",

    payment_method:
      order.payment_method ||
      "ai_commerce",

    payment_method_title:
      order.payment_method_title ||
      "AI Commerce",

    set_paid:
      false,

    billing,

    shipping,

    line_items:
      lineItems,

    customer_note:
      "Order created through AI Commerce.",

    meta_data: [

      {

        key:
          "_ai_commerce_order_id",

        value:
          String(
            order._id
          )

      },

      {

        key:
          "_ai_commerce_source",

        value:
          "ai_commerce"

      }

    ]

  }


  /*
  --------------------------------
  CREATE ORDER
  --------------------------------
  */

  let response

  try {

    response =
      await client.post(

        "/orders",

        payload

      )

  } catch (error) {

    const message =
      error.response?.data?.message ||
      error.message

    console.error(

      "WooCommerce order creation error:",

      error.response?.data ||
      error.message

    )

    throw new Error(

      `WooCommerce order creation failed: ${message}`

    )

  }


  if (
    !response.data ||
    !response.data.id
  ) {

    throw new Error(
      "WooCommerce returned an invalid order response"
    )

  }


  /*
  --------------------------------
  RETURN RESULT
  --------------------------------
  */

  return {

    id:
      response.data.id,

    order_number:
      response.data.number ||
      String(
        response.data.id
      ),

    status:
      response.data.status,

    payment_status:
      response.data.payment_status,

    total:
      response.data.total,

    currency:
      response.data.currency,

    raw:
      response.data

  }

}


/*
================================
MODULE EXPORTS
================================
*/

module.exports = {

  syncWooProducts,

  syncWooProduct,

  createWooCommerceOrder

}