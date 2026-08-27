const crypto =
  require("crypto")


function createCustomerConversationToken({
  storeId,
  channel
}) {

  const secret =
    process.env.CUSTOMER_CONVERSATION_SECRET


  if (!secret) {

    throw new Error(
      "CUSTOMER_CONVERSATION_SECRET is not configured"
    )

  }


  const timestamp =
    Date.now()


  const payload =
    `${storeId}.${channel}.${timestamp}`


  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("hex")


  return (
    `${payload}.${signature}`
  )

}


module.exports = {

  createCustomerConversationToken

}