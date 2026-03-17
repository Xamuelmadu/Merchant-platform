const axios = require("axios")
const Product = require("../models/Product")

async function syncWooProducts(storeId, storeUrl, key, secret) {

  try {

    let page = 1
    let allProducts = []
    let hasMore = true

    while (hasMore) {

      const response = await axios.get(
        `${storeUrl}/wp-json/wc/v3/products`,
        {
          auth: {
            username: key,
            password: secret
          },
          params: {
            per_page: 100,
            page: page
          },
          timeout: 10000
        }
      )

      const products = response.data

      if (!products.length) {
        hasMore = false
        break
      }

      allProducts = allProducts.concat(products)

      page++

    }

    console.log(`Fetched ${allProducts.length} products from WooCommerce`)

    const formatted = allProducts.map(p => ({

      store_id: storeId,

      name: p.name,

      description: p.description || "",

      price: Number(p.price) || 0,

      stock: p.stock_quantity || 0,

      images: p.images ? p.images.map(img => img.src) : [],

      product_url: p.permalink,

      source: "woocommerce"

    }))

    // Prevent duplicate imports
    const existingProducts = await Product.find({ store_id: storeId })

    const existingNames = new Set(existingProducts.map(p => p.name))

    const newProducts = formatted.filter(p => !existingNames.has(p.name))

    if (!newProducts.length) {

      console.log("No new WooCommerce products to import")

      return 0

    }

    await Product.insertMany(newProducts)

    console.log(`${newProducts.length} new products saved`)

    return newProducts.length

  } catch (error) {

    console.error("WooCommerce API error:", error.message)

    throw new Error("WooCommerce API connection failed")

  }

}

module.exports = { syncWooProducts }