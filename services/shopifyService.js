const Product = require("../models/product")

/*
--------------------------------
SYNC SHOPIFY PRODUCTS
--------------------------------
*/

async function syncShopifyProducts({
  store,
  products
}) {

  if (!store) {
    throw new Error("Store is required")
  }

  if (!Array.isArray(products)) {
    throw new Error("Products must be an array")
  }

  /*
  --------------------------------
  REMOVE DELETED SHOPIFY PRODUCTS
  --------------------------------
  */

  const incomingIds =
    products
      .map(product => product.id)
      .filter(Boolean)
      .map(String)

  if (incomingIds.length > 0) {

    await Product.deleteMany({
      store_id: store._id,
      source: "shopify",
      external_id: {
        $nin: incomingIds
      }
    })

  }

  /*
  --------------------------------
  UPSERT PRODUCTS
  --------------------------------
  */

  let synced = 0

  for (const product of products) {

    if (!product.id) {
      continue
    }

    /*
    --------------------------------
    PRICE
    --------------------------------
    */

    const price =
      Number(
        product.priceRange
          ?.minVariantPrice
          ?.amount
      ) || 0


    /*
    --------------------------------
    CURRENCY
    --------------------------------
    */

    const currency =
      product.priceRange
        ?.minVariantPrice
        ?.currencyCode ||
      "USD"


    /*
    --------------------------------
    TOTAL INVENTORY
    --------------------------------
    */

    const stock =
      Number(
        product.totalInventory
      ) || 0


    /*
    --------------------------------
    IMAGES
    --------------------------------
    */

    const images =
      product.featuredImage?.url
        ? [
            product.featuredImage.url
          ]
        : []


    /*
    --------------------------------
    PRODUCT URL
    --------------------------------
    */

    const shopDomain =
      store.shopify?.shop_domain

    const productUrl =
      product.handle &&
      shopDomain
        ? `https://${shopDomain}/products/${product.handle}`
        : ""


    /*
    --------------------------------
    NORMALIZE VARIANTS
    --------------------------------
    */

    const variants =
      Array.isArray(
        product.variants?.nodes
      )
        ? product.variants.nodes
            .filter(
              variant =>
                Boolean(variant.id)
            )
            .map(variant => {

              /*
              Convert Shopify:

              selectedOptions:
              [
                {
                  name: "Size",
                  value: "M"
                },
                {
                  name: "Color",
                  value: "Black"
                }
              ]

              into:

              attributes:
              {
                Size: "M",
                Color: "Black"
              }
              */

              const attributes = {}

              if (
                Array.isArray(
                  variant.selectedOptions
                )
              ) {

                for (
                  const option
                  of variant.selectedOptions
                ) {

                  if (
                    option?.name &&
                    option?.value
                  ) {

                    attributes[
                      option.name
                    ] =
                      option.value

                  }

                }

              }

              const variantStock =
                variant.inventoryQuantity == null
                  ? 0
                  : Number(
                      variant.inventoryQuantity
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
                  variantStock,

                available:
                  variant.inventoryQuantity == null
                    ? true
                    : variantStock > 0,

                attributes

              }

            })
        : []


    /*
    --------------------------------
    UPSERT
    --------------------------------
    */

    await Product.findOneAndUpdate(

      {
        store_id:
          store._id,

        source:
          "shopify",

        external_id:
          String(product.id)
      },

      {
        $set: {

          store_id:
            store._id,

          external_id:
            String(product.id),

          name:
            product.title ||
            "",

          description:
            product.description ||
            "",

          price,

          currency,

          stock,

          images,

          product_url:
            productUrl,

          variants,

          source:
            "shopify"

        }
      },

      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }

    )

    synced++

  }


  /*
  --------------------------------
  UPDATE STORE SYNC STATE
  --------------------------------
  */

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


  return {
    synced
  }

}


module.exports = {
  syncShopifyProducts
}