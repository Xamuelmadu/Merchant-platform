const Product = require("../models/product")
const Customer = require("../models/customer")
const Order = require("../models/order")
const { syncWooProduct } = require("../services/woocommerceService")


const axios = require("axios")
const crypto = require("crypto")

const Store = require("../models/store")
const { getPlan, getPlanPrice } = require("../config/plan")

async function flutterwaveWebhook(req, res) {
  try {
    // --------------------------------
    // 1. VALIDATE WEBHOOK SIGNATURE
    // --------------------------------

    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET
    const receivedHash = req.headers["verif-hash"]

    if (!webhookSecret) {
      console.error("FLUTTERWAVE_WEBHOOK_SECRET is not configured")
      return res.status(500).json({
        error: "Webhook secret is not configured"
      })
    }

    if (!receivedHash) {
      return res.status(401).json({
        error: "Missing webhook signature"
      })
    }

    const receivedBuffer = Buffer.from(String(receivedHash))
    const expectedBuffer = Buffer.from(String(webhookSecret))

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(401).json({
        error: "Invalid webhook signature"
      })
    }

    // --------------------------------
    // 2. VALIDATE PAYLOAD
    // --------------------------------

    const event = req.body

    if (!event || typeof event !== "object") {
      return res.status(400).json({
        error: "Invalid webhook payload"
      })
    }

    const data = event.data || {}
    const eventType = event.event || event.type || ""

    const eventStatus = String(data.status || "").toLowerCase()

    const transactionId = data.id
    const transactionReference = String(
      data.tx_ref || data.reference || ""
    ).trim()

    console.log("Flutterwave webhook received:", {
      event: eventType,
      status: eventStatus,
      reference: transactionReference,
      transactionId
    })

    // Only successful transactions can activate subscriptions.
    if (eventStatus !== "successful") {
      return res.status(200).json({
        received: true,
        processed: false,
        reason: "Transaction is not successful"
      })
    }

    if (!transactionId || !transactionReference) {
      return res.status(400).json({
        error: "Transaction ID or reference is missing"
      })
    }

    // --------------------------------
    // 3. VERIFY TRANSACTION WITH FLW
    // --------------------------------

    const flutterwaveSecret = process.env.FLUTTERWAVE_SECRET_KEY

    if (!flutterwaveSecret) {
      console.error("FLUTTERWAVE_SECRET_KEY is not configured")
      return res.status(500).json({
        error: "Flutterwave secret key is not configured"
      })
    }

    const verificationResponse = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
        transactionId
      )}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveSecret}`,
          Accept: "application/json"
        },
        timeout: 15000
      }
    )

    const verified = verificationResponse.data?.data

    if (
      verificationResponse.data?.status !== "success" ||
      !verified
    ) {
      return res.status(400).json({
        error: "Flutterwave transaction verification failed"
      })
    }

    const verifiedStatus = String(
      verified.status || ""
    ).toLowerCase()

    const verifiedReference = String(
      verified.tx_ref || ""
    ).trim()

    if (verifiedStatus !== "successful") {
      return res.status(200).json({
        received: true,
        processed: false,
        reason: "Verified transaction is not successful"
      })
    }

    if (verifiedReference !== transactionReference) {
      console.error("Flutterwave transaction reference mismatch")

      return res.status(400).json({
        error: "Transaction reference mismatch"
      })
    }

    // --------------------------------
    // 4. IDENTIFY SUBSCRIPTION
    // --------------------------------

    // Expected reference:
    // subscription_STOREID_PLAN_BILLINGCYCLE
    //
    // Example:
    // subscription_64abcdef1234567890123456_pro_monthly

    const referenceMatch = transactionReference.match(
      /^subscription_([a-fA-F0-9]{24})_(basic|pro|premium)_(monthly|yearly)$/
    )

    if (!referenceMatch) {
      console.log(
        "Ignoring non-subscription Flutterwave transaction:",
        transactionReference
      )

      return res.status(200).json({
        received: true,
        processed: false,
        reason: "Not a platform subscription transaction"
      })
    }

    const storeId = referenceMatch[1]
    const planName = referenceMatch[2].toLowerCase()
    const billingCycle = referenceMatch[3].toLowerCase()

    // --------------------------------
    // 5. LOAD STORE AND PLAN
    // --------------------------------

    const store = await Store.findById(storeId)

    if (!store) {
      return res.status(200).json({
        received: true,
        processed: false,
        reason: "Store not found"
      })
    }

    const plan = getPlan(planName)

    if (
      !plan ||
      String(plan.name || "").toLowerCase() !== planName
    ) {
      return res.status(400).json({
        error: "Invalid subscription plan"
      })
    }

    const expectedAmount = Number(
      getPlanPrice(planName, billingCycle)
    )

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({
        error: "Invalid subscription price configuration"
      })
    }

    // --------------------------------
    // 6. VALIDATE AMOUNT AND CURRENCY
    // --------------------------------

    const expectedCurrency = String(
      process.env.FLUTTERWAVE_CURRENCY || "USD"
    ).toUpperCase()

    const verifiedCurrency = String(
      verified.currency || ""
    ).toUpperCase()

    const verifiedAmount = Number(verified.amount)

    if (verifiedCurrency !== expectedCurrency) {
      console.error("Subscription currency mismatch:", {
        expectedCurrency,
        verifiedCurrency
      })

      return res.status(400).json({
        error: "Subscription currency mismatch"
      })
    }

    // Allow only a tiny floating-point tolerance.
    if (
      !Number.isFinite(verifiedAmount) ||
      Math.abs(verifiedAmount - expectedAmount) > 0.01
    ) {
      console.error("Subscription amount mismatch:", {
        expectedAmount,
        verifiedAmount
      })

      return res.status(400).json({
        error: "Subscription payment amount mismatch"
      })
    }

    // --------------------------------
    // 7. IDEMPOTENCY / DUPLICATE CHECK
    // --------------------------------

    if (
      String(store.flutterwave_subscription_reference || "") ===
        transactionReference &&
      String(store.flutterwave_transaction_id || "") ===
        String(transactionId) &&
      store.subscription_status === "active"
    ) {
      return res.status(200).json({
        received: true,
        processed: false,
        duplicate: true
      })
    }

    // --------------------------------
    // 8. CALCULATE RENEWAL DATE
    // --------------------------------

    const now = new Date()
    const renewal = new Date(now)

    if (billingCycle === "monthly") {
      renewal.setMonth(renewal.getMonth() + 1)
    } else {
      renewal.setFullYear(renewal.getFullYear() + 1)
    }

    // --------------------------------
    // 9. ACTIVATE SUBSCRIPTION
    // --------------------------------

    store.plan = planName
    store.subscription_status = "active"
    store.subscription_renewal = renewal

    store.billing_grace_until = null
    store.system_locked = false

    store.monthly_order_limit = plan.monthly_order_limit
    store.transaction_fee = plan.transaction_fee

    store.flutterwave_transaction_id = String(transactionId)
    store.flutterwave_subscription_reference = transactionReference
    store.flutterwave_billing_cycle = billingCycle
    store.flutterwave_last_payment_at = now

    store.orders_used = 0

    await store.save()

    console.log("Flutterwave subscription activated:", {
      storeId: String(store._id),
      plan: planName,
      billingCycle,
      amount: verifiedAmount,
      currency: verifiedCurrency,
      transactionReference,
      renewal: renewal.toISOString()
    })

    return res.status(200).json({
      received: true,
      processed: true,
      plan: planName,
      billing_cycle: billingCycle,
      subscription_status: "active"
    })

  } catch (error) {
    console.error(
      "Flutterwave webhook error:",
      error.response?.data || error.message || error
    )

    return res.status(500).json({
      error: "Webhook processing failed"
    })
  }
}


/*
================================
HANDLE SUBSCRIPTION FAILURE
================================

Used by billing/subscription logic
when a Flutterwave subscription
payment fails or expires.
================================
*/

async function handleSubscriptionFailure(storeId) {
  if (!storeId) {
    throw new Error("Store ID is required")
  }

  const store = await Store.findById(storeId)

  if (!store) {
    throw new Error("Store not found")
  }

  store.subscription_status = "past_due"

  const graceUntil = new Date()
  graceUntil.setDate(graceUntil.getDate() + 7)

  store.billing_grace_until = graceUntil

  await store.save()

  return store
}

/*
================================
HANDLE SUBSCRIPTION CANCELLATION
================================
*/

async function handleSubscriptionCancelled(storeId) {
  if (!storeId) {
    throw new Error("Store ID is required")
  }

  const store = await Store.findById(storeId)

  if (!store) {
    throw new Error("Store not found")
  }

  store.subscription_status = "cancelled"
  store.billing_grace_until = null

  await store.save()

  return store
}

/*
================================
WOOCOMMERCE WEBHOOK HELPERS
================================
*/

function normalizeWebhookStoreUrl(value) {
  try {
    const url = new URL(String(value || "").trim())

    return `${url.origin}${url.pathname}`
      .replace(/\/+$/, "")
      .toLowerCase()

  } catch {
    return ""
  }
}

function getWooCustomerName(billing = {}) {
  const name = [
    billing.first_name,
    billing.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  return (
    name ||
    billing.company ||
    billing.email ||
    "WooCommerce Customer"
  )
}

function getWooCustomerAddress(billing = {}) {
  return [
    billing.address_1,
    billing.address_2,
    billing.city,
    billing.state,
    billing.postcode,
    billing.country
  ]
    .filter(Boolean)
    .join(", ")
}

function mapWooOrderStatus(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return "completed"

    case "processing":
    case "on-hold":
      return "paid"

    case "cancelled":
    case "refunded":
    case "failed":
      return "cancelled"

    default:
      return "new"
  }
}

function mapWooPaymentStatus(order = {}) {
  const status = String(order.status || "").toLowerCase()

  if (status === "refunded") return "refunded"
  if (status === "cancelled") return "cancelled"
  if (status === "failed") return "failed"

  if (
    order.date_paid ||
    status === "processing" ||
    status === "completed"
  ) {
    return "paid"
  }

  return "pending"
}

/*
================================
FIND CONNECTED WOOCOMMERCE STORE
================================
*/

async function findWooCommerceWebhookStore(sourceUrl) {
  const normalizedSource =
    normalizeWebhookStoreUrl(sourceUrl)

  if (!normalizedSource) {
    return null
  }

  const stores = await Store.find({
    "woocommerce.connected": true,
    "woocommerce.webhook_secret": {
      $exists: true,
      $ne: ""
    }
  })

  return stores.find(store => {
    const storedUrl = normalizeWebhookStoreUrl(
      store.woocommerce?.store_url
    )

    return storedUrl === normalizedSource
  }) || null
}

/*
================================
SYNC WOOCOMMERCE CUSTOMER
================================

Guest orders do not create customer
records. Existing customers are matched
by WooCommerce customer ID.

The phone fallback respects the
unique store_id + phone index.
================================
*/

async function syncWooCommerceCustomer(store, wooOrder) {
  const billing = wooOrder.billing || {}

  const externalCustomerId = wooOrder.customer
    ? String(wooOrder.customer)
    : ""

  if (
    !externalCustomerId ||
    externalCustomerId === "0"
  ) {
    return null
  }

  const phone = String(billing.phone || "").trim()

  const customerData = {
    name: getWooCustomerName(billing),
    email: String(billing.email || "")
      .trim()
      .toLowerCase(),
    phone,
    last_seen: new Date()
  }

  let customer = await Customer.findOne({
    store_id: store._id,
    source: "woocommerce",
    external_id: externalCustomerId
  })

  if (customer) {
    Object.assign(customer, customerData)
    await customer.save()
    return customer
  }

  if (phone) {
    customer = await Customer.findOne({
      store_id: store._id,
      phone
    })

    if (customer) {
      return customer
    }
  }

  customer = await Customer.create({
    store_id: store._id,
    source: "woocommerce",
    external_id: externalCustomerId,
    ...customerData
  })

  return customer
}

/*
================================
SYNC WOOCOMMERCE ORDER
================================

Canonical identity:
store_id + source + external_id

Webhook retries update the existing
order instead of creating duplicates.
================================
*/

async function syncWooCommerceOrder(store, wooOrder) {
  if (!wooOrder || !wooOrder.id) {
    throw new Error("WooCommerce order ID is missing")
  }

  const billing = wooOrder.billing || {}

  const customer = await syncWooCommerceCustomer(
    store,
    wooOrder
  )

  const wooLineItems = Array.isArray(wooOrder.line_items)
    ? wooOrder.line_items
    : []

  const externalProductIds = [
    ...new Set(
      wooLineItems
        .map(item => String(item.product_id || ""))
        .filter(Boolean)
    )
  ]

  const internalProducts = externalProductIds.length
    ? await Product.find({
        store_id: store._id,
        source: "woocommerce",
        external_id: { $in: externalProductIds }
      }).select("_id external_id")
    : []

  const productIdMap = new Map(
    internalProducts.map(product => [
      String(product.external_id),
      product._id
    ])
  )

  const items = wooLineItems.map(item => {
    const externalProductId = String(item.product_id || "")

    const quantity = Math.max(
      1,
      Number(item.quantity) || 1
    )

    const unitPrice = Math.max(
      0,
      Number(item.price) || 0
    )

    return {
      product_id: productIdMap.get(externalProductId),
      external_product_id: externalProductId,
      name: item.name || "",
      sku: item.sku || "",
      quantity,
      unit_price: unitPrice,
      total_price: Math.max(
        0,
        Number(item.total) || 0
      )
    }
  })

  const orderStatus = mapWooOrderStatus(wooOrder.status)
  const paymentStatus = mapWooPaymentStatus(wooOrder)

  const orderData = {
    store_id: store._id,
    source: "woocommerce",
    external_id: String(wooOrder.id),

    order_number: String(
      wooOrder.number || wooOrder.id
    ),

    customer_id: customer?._id,

    external_customer_id: wooOrder.customer
      ? String(wooOrder.customer)
      : "",

    customer_name: getWooCustomerName(billing),

    customer_email: String(billing.email || "")
      .trim()
      .toLowerCase(),

    customer_phone: String(billing.phone || "").trim(),

    customer_address: getWooCustomerAddress(billing),

    items,

    subtotal: Math.max(
      0,
      Number(wooOrder.subtotal) || 0
    ),

    total_price: Math.max(
      0,
      Number(wooOrder.total) || 0
    ),

    currency: String(
      wooOrder.currency || "USD"
    ).toUpperCase(),

    payment_status: paymentStatus,

    payment_reference: wooOrder.transaction_id || "",

    payment_transaction_id: wooOrder.transaction_id || "",

    payment_gateway: wooOrder.payment_method || "",

    order_status: orderStatus,

    ordered_at: wooOrder.date_created
      ? new Date(wooOrder.date_created)
      : new Date()
  }

  if (wooOrder.date_completed) {
    orderData.fulfilled_at = new Date(
      wooOrder.date_completed
    )
  }

  if (orderStatus === "cancelled") {
    orderData.cancelled_at = new Date()
  }

  const update = {
    $set: orderData,
    $unset: {}
  }

  if (!wooOrder.date_completed) {
    update.$unset.fulfilled_at = 1
  }

  if (orderStatus !== "cancelled") {
    update.$unset.cancelled_at = 1
  }

  if (!Object.keys(update.$unset).length) {
    delete update.$unset
  }

  return Order.findOneAndUpdate(
    {
      store_id: store._id,
      source: "woocommerce",
      external_id: String(wooOrder.id)
    },
    update,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  )
}

/*
================================
WOOCOMMERCE WEBHOOK
================================

Endpoint:
POST /webhooks/woocommerce

Verifies the WooCommerce HMAC
signature using the exact raw request
body, then processes product and
order events.
================================
*/

async function woocommerceWebhook(req, res) {
  try {
    const rawBody = req.body

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({
        success: false,
        error: "Raw webhook body is required"
      })
    }

    const signature =
      req.headers["x-wc-webhook-signature"]

    const sourceUrl =
      req.headers["x-wc-webhook-source"]

    const topic = String(
      req.headers["x-wc-webhook-topic"] || ""
    ).toLowerCase()

    if (!signature || !sourceUrl || !topic) {
      return res.status(400).json({
        success: false,
        error: "Missing WooCommerce webhook headers"
      })
    }

    /*
    --------------------------------
    IDENTIFY CONNECTED STORE
    --------------------------------
    */

    const store = await findWooCommerceWebhookStore(
      sourceUrl
    )

    if (!store) {
      console.warn(
        "WooCommerce webhook source not connected:",
        sourceUrl
      )

      return res.status(404).json({
        success: false,
        error: "Connected WooCommerce store not found"
      })
    }

    /*
    --------------------------------
    VERIFY HMAC SIGNATURE
    --------------------------------
    */

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        store.woocommerce.webhook_secret
      )
      .update(rawBody)
      .digest("base64")

    const receivedBuffer = Buffer.from(
      String(signature)
    )

    const expectedBuffer = Buffer.from(
      expectedSignature
    )

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      console.warn(
        "Invalid WooCommerce webhook signature:",
        store._id.toString()
      )

      return res.status(401).json({
        success: false,
        error: "Invalid webhook signature"
      })
    }

    /*
    --------------------------------
    PARSE VERIFIED PAYLOAD
    --------------------------------
    */

    let payload

    try {
      payload = JSON.parse(rawBody.toString("utf8"))
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid JSON webhook payload"
      })
    }

    console.log("WooCommerce webhook received:", {
      store: store._id.toString(),
      topic,
      resource: req.headers["x-wc-webhook-resource"],
      id: payload.id
    })

    /*
    --------------------------------
    PRODUCT CREATED / UPDATED
    --------------------------------
    */

    if (
      topic === "product.created" ||
      topic === "product.updated"
    ) {
      if (!payload.id) {
        return res.status(400).json({
          success: false,
          error: "Product ID is missing"
        })
      }

      const result = await syncWooProduct(
        store,
        payload.id
      )

      if (result?.deleted) {
        await Product.deleteOne({
          store_id: store._id,
          source: "woocommerce",
          external_id: String(payload.id)
        })
      }

      store.woocommerce.last_product_sync = new Date()
      await store.save()

      return res.status(200).json({
        success: true,
        processed: true,
        resource: "product",
        id: payload.id
      })
    }

    /*
    --------------------------------
    PRODUCT DELETED
    --------------------------------
    */

    if (topic === "product.deleted") {
      if (!payload.id) {
        return res.status(400).json({
          success: false,
          error: "Product ID is missing"
        })
      }

      await Product.deleteOne({
        store_id: store._id,
        source: "woocommerce",
        external_id: String(payload.id)
      })

      store.woocommerce.last_product_sync = new Date()
      await store.save()

      return res.status(200).json({
        success: true,
        processed: true,
        deleted: true,
        resource: "product",
        id: payload.id
      })
    }

    /*
    --------------------------------
    ORDER CREATED / UPDATED
    --------------------------------
    */

    if (
      topic === "order.created" ||
      topic === "order.updated"
    ) {
      const savedOrder = await syncWooCommerceOrder(
        store,
        payload
      )

      store.woocommerce.last_order_sync = new Date()
      await store.save()

      return res.status(200).json({
        success: true,
        processed: true,
        resource: "order",
        id: savedOrder.external_id
      })
    }

    /*
    --------------------------------
    ORDER DELETED
    --------------------------------

    Preserve historical order data.
    Mark the order cancelled rather
    than physically deleting it.
    --------------------------------
    */

    if (topic === "order.deleted") {
      if (!payload.id) {
        return res.status(400).json({
          success: false,
          error: "Order ID is missing"
        })
      }

      await Order.findOneAndUpdate(
        {
          store_id: store._id,
          source: "woocommerce",
          external_id: String(payload.id)
        },
        {
          $set: {
            order_status: "cancelled",
            payment_status: "cancelled",
            cancelled_at: new Date()
          }
        },
        {
          runValidators: true
        }
      )

      store.woocommerce.last_order_sync = new Date()
      await store.save()

      return res.status(200).json({
        success: true,
        processed: true,
        deleted: true,
        resource: "order",
        id: payload.id
      })
    }

    /*
    --------------------------------
    UNKNOWN TOPIC
    --------------------------------

    Acknowledge unknown topics so
    WooCommerce does not retry events
    this endpoint does not support.
    --------------------------------
    */

    return res.status(200).json({
      success: true,
      processed: false,
      reason: "Webhook topic not handled",
      topic
    })

  } catch (error) {
    console.error(
      "WooCommerce webhook processing error:",
      error.response?.data ||
      error.message ||
      error
    )

    return res.status(500).json({
      success: false,
      error: "WooCommerce webhook processing failed"
    })
  }
}

/*
================================
EXPORTS
================================
*/

module.exports = {
  flutterwaveWebhook,
  woocommerceWebhook,
  handleSubscriptionFailure,
  handleSubscriptionCancelled
}