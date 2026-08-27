function shopifyIntegration(req, res, next) {

  const secret =
    req.headers["x-shopify-integration-secret"]

  const expected =
    process.env.SHOPIFY_INTEGRATION_SECRET

  if (!expected) {

    console.error(
      "SHOPIFY_INTEGRATION_SECRET is not configured"
    )

    return res.status(500).json({
      error: "Shopify integration is not configured"
    })

  }

  if (!secret || secret !== expected) {

    return res.status(401).json({
      error: "Unauthorized Shopify integration request"
    })

  }

  return next()

}

module.exports = shopifyIntegration