const crypto = require("crypto")


function customerConversationAuth(
  req,
  res,
  next
) {

  const secret =
    process.env.CUSTOMER_CONVERSATION_SECRET


  if (!secret) {

    console.error(
      "CUSTOMER_CONVERSATION_SECRET is not configured"
    )

    return res.status(500).json({

      success: false,

      error:
        "Conversation service is not configured"

    })

  }


  const providedToken =
    req.headers[
      "x-ai-commerce-token"
    ]


  if (!providedToken) {

    return res.status(401).json({

      success: false,

      error:
        "Conversation token is required"

    })

  }


  /*
  --------------------------------
  SIGNATURE FORMAT
  --------------------------------

  token =
  storeId.channel.timestamp.signature
  --------------------------------
  */

  const parts =
    providedToken.split(".")


  if (parts.length !== 4) {

    return res.status(401).json({

      success: false,

      error:
        "Invalid conversation token"

    })

  }


  const [
    storeId,
    channel,
    timestamp,
    signature
  ] = parts


  const timestampNumber =
    Number(timestamp)


  if (
    !storeId ||
    !channel ||
    !timestampNumber ||
    !signature
  ) {

    return res.status(401).json({

      success: false,

      error:
        "Invalid conversation token"

    })

  }


  /*
  --------------------------------
  TOKEN EXPIRY
  --------------------------------
  */

  const TOKEN_WINDOW =
    10 * 60 * 1000


  if (
    Math.abs(
      Date.now() -
      timestampNumber
    ) > TOKEN_WINDOW
  ) {

    return res.status(401).json({

      success: false,

      error:
        "Conversation token expired"

    })

  }


  /*
  --------------------------------
  VERIFY SIGNATURE
  --------------------------------
  */

  const payload =
    `${storeId}.${channel}.${timestamp}`


  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("hex")


  const signaturesMatch =
    crypto.timingSafeEqual(

      Buffer.from(
        signature,
        "utf8"
      ),

      Buffer.from(
        expectedSignature,
        "utf8"
      )

    )


  if (!signaturesMatch) {

    return res.status(401).json({

      success: false,

      error:
        "Invalid conversation token"

    })

  }


  /*
  --------------------------------
  ATTACH TRUSTED CONTEXT
  --------------------------------
  */

  req.conversationContext = {

    storeId,

    channel

  }


  next()

}


module.exports =
  customerConversationAuth