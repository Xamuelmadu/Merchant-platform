const crypto = require("crypto")

const ShopifyWebAuth = require("../models/shopifyWebAuth")

const HANDOFF_TTL_MINUTES = 10

function generateHandoffToken() {
  return crypto.randomBytes(32).toString("hex")
}

function hashHandoffToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")
}

async function createShopifyWebAuthHandoff({
  merchantId = null,
  returnUrl
}) {
  if (!returnUrl) {
    throw new Error("returnUrl is required")
  }

  const rawToken = generateHandoffToken()

  const tokenHash = hashHandoffToken(rawToken)

  const expiresAt = new Date(
    Date.now() +
      HANDOFF_TTL_MINUTES *
        60 *
        1000
  )

  await ShopifyWebAuth.create({
    token_hash: tokenHash,
    merchant_id: merchantId || null,
    return_url: returnUrl,
    expires_at: expiresAt,
    used: false
  })

  return {
    token: rawToken,
    expires_at: expiresAt
  }
}

async function consumeShopifyWebAuthHandoff(
  rawToken
) {
  if (!rawToken) {
    return null
  }

  const tokenHash =
    hashHandoffToken(rawToken)

  const record =
    await ShopifyWebAuth.findOne({
      token_hash: tokenHash,
      used: false,
      expires_at: {
        $gt: new Date()
      }
    })

  if (!record) {
    return null
  }

  record.used = true
  record.used_at = new Date()

  await record.save()

  return record
}

module.exports = {
  createShopifyWebAuthHandoff,
  consumeShopifyWebAuthHandoff
}