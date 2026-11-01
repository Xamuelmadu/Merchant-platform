const crypto = require("crypto");

function customerConversationAuth(req, res, next) {
  const secret = process.env.CUSTOMER_CONVERSATION_SECRET;

  if (!secret) {
    console.error(
      "CUSTOMER_CONVERSATION_SECRET is not configured"
    );

    return res.status(500).json({
      success: false,
      error: "Conversation service is not configured",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | READ TOKEN
  |--------------------------------------------------------------------------
  */

  const providedToken = req.headers["x-ai-commerce-token"];

  if (!providedToken || typeof providedToken !== "string") {
    return res.status(401).json({
      success: false,
      error: "Conversation token is required",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | TOKEN FORMAT
  |--------------------------------------------------------------------------
  |
  | storeId.channel.timestamp.signature
  |
  */

  const parts = providedToken.split(".");

  if (parts.length !== 4) {
    return res.status(401).json({
      success: false,
      error: "Invalid conversation token",
    });
  }

  const [storeId, channel, timestamp, signature] = parts;

  const timestampNumber = Number(timestamp);

  if (
    !storeId ||
    !["shopify", "woocommerce", "custom"].includes(channel) ||
    !Number.isSafeInteger(timestampNumber) ||
    timestampNumber <= 0 ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return res.status(401).json({
      success: false,
      error: "Invalid conversation token",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | TOKEN EXPIRATION
  |--------------------------------------------------------------------------
  */

  const TOKEN_WINDOW = 10 * 60 * 1000;

  if (
    Math.abs(Date.now() - timestampNumber) > TOKEN_WINDOW
  ) {
    return res.status(401).json({
      success: false,
      error: "Conversation token expired",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY SIGNATURE
  |--------------------------------------------------------------------------
  */

  const payload = `${storeId}.${channel}.${timestamp}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const receivedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  const signaturesMatch =
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    );

  if (!signaturesMatch) {
    return res.status(401).json({
      success: false,
      error: "Invalid conversation token",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | ATTACH TRUSTED CONVERSATION CONTEXT
  |--------------------------------------------------------------------------
  */

  req.conversationContext = {
    storeId,
    channel,
  };

  return next();
}

module.exports = customerConversationAuth;