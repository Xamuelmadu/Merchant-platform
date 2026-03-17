const axios = require("axios")
const Product = require("../models/Product")

async function syncShopifyProducts(storeId, shop, accessToken) {

  try {

    let allProducts = []
    let url = `https://${shop}/admin/api/2024-01/products.json?limit=250`

    while (url) {

      const response = await axios.get(url, {
        headers: {
          "X-Shopify-Access-Token": accessToken
        }
      })

      const products = response.data.products

      allProducts = allProducts.concat(products)

      const link = response.headers.link

      if (link && link.includes('rel="next"')) {
        url = link.match(/<(.*?)>/)[1]
      } else {
        url = null
      }

    }

    const formatted = allProducts.map(p => ({

      store_id: storeId,

      name: p.title,

      description: p.body_html,

      price: Number(p.variants[0]?.price) || 0,

      stock: p.variants[0]?.inventory_quantity || 0,

      images: p.images.map(img => img.src),

      product_url: `https://${shop}/products/${p.handle}`,

      source: "shopify"

    }))

    await Product.insertMany(formatted)

    return formatted.length

  } catch (error) {

    console.error("Shopify sync error:", error.message)

    throw new Error("Shopify API connection failed")

  }

}

module.exports = { syncShopifyProducts }