$ErrorActionPreference = "Stop"

$projectPath = "C:\Users\Hp laptop\whatsapp-commerce-platform\merchant-platform"
$targetPath = Join-Path $projectPath "controllers\webhookController.js"

if (-not (Test-Path $projectPath)) {
    throw "Project directory not found: $projectPath"
}

$controllerCode = @'
const crypto = require("crypto")

const Store = require("../models/store")
const { getPlan } = require("../config/plan")

const Product = require("../models/product")
const Customer = require("../models/customer")
const Order = require("../models/order")

const {
  syncWooProduct
} = require("../services/woocommerceService")



/*
================================
FLUTTERWAVE WEBHOOK
================================

Handles Flutterwave events related
to Merchant Platform subscriptions.

IMPORTANT:

This webhook is ONLY for platform
subscription billing.

Merchant customer checkout does NOT
run through this webhook.

Shopify customers use Shopify checkout.

WooCommerce customers use WooCommerce
checkout.

Paystack is NOT used here.
================================
*/

async function flutterwaveWebhook(req, res) {

  try {

    /*
    --------------------------------
    VERIFY WEBHOOK SECRET
    --------------------------------
    */

    const webhookSecret =
      process.env.FLUTTERWAVE_WEBHOOK_SECRET


    if (!webhookSecret) {

      console.error(
        "Flutterwave webhook secret is not configured"
      )

      return res.status(500).json({
        error:
          "Flutterwave webhook secret is not configured"
      })

    }


    /*
    --------------------------------
    FLUTTERWAVE SIGNATURE
    --------------------------------

    Flutterwave sends the configured
    webhook secret through verif-hash.
    --------------------------------
    */

    const receivedHash =
      req.headers["verif-hash"]


    if (!receivedHash) {

      console.warn(
        "Flutterwave webhook missing verif-hash"
      )

      return res.status(401).json({
        error:
          "Invalid webhook signature"
      })

    }


    const receivedBuffer =
      Buffer.from(
        String(receivedHash)
      )

    const expectedBuffer =
      Buffer.from(
        String(webhookSecret)
      )


    /*
    --------------------------------
    CONSTANT-TIME COMPARISON
    --------------------------------
    */

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {

      return res.status(401).json({
        error:
          "Invalid webhook signature"
      })

    }


    if (
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {

      console.warn(
        "Invalid Flutterwave webhook signature"
      )

      return res.status(401).json({
        error:
          "Invalid webhook signature"
      })

    }


    /*
    --------------------------------
    WEBHOOK PAYLOAD
    --------------------------------
    */

    const event =
      req.body


    if (!event) {

      return res.status(400).json({
        error:
          "Webhook payload is empty"
      })

    }


    const eventType =
      event.event ||
      event.type ||
      ""


    const data =
      event.data || {}


    const status =
      String(
        data.status ||
        ""
      ).toLowerCase()


    const transactionReference =
      data.tx_ref ||
      data.reference ||
      ""


    const transactionId =
      data.id ||
      null


    console.log(
      "Flutterwave webhook received:",
      {
        event: eventType,
        status,
        reference: transactionReference,
        transactionId
      }
    )


    /*
    --------------------------------
    ONLY PROCESS SUCCESSFUL PAYMENTS
    --------------------------------
    */

    if (
      status &&
      status !== "successful"
    ) {

      console.log(
        `Flutterwave transaction status: ${status}`
      )

      return res.status(200).json({

        received: true,

        processed: false,

        status

      })

    }


    /*
    --------------------------------
    FIND STORE ID
    --------------------------------

    Preferred location:

    data.meta.store_id

    Fallback:

    subscription_STOREID_PLAN_CYCLE
    --------------------------------
    */

    let storeId =
      data.meta?.store_id ||
      data.metadata?.store_id ||
      null


    /*
    --------------------------------
    PARSE STORE ID FROM REFERENCE
    --------------------------------
    */

    if (
      !storeId &&
      transactionReference
    ) {

      const match =
        transactionReference.match(
          /subscription_([a-fA-F0-9]{24})/
        )


      if (match) {

        storeId =
          match[1]

      }

    }


    /*
    --------------------------------
    STORE ID REQUIRED
    --------------------------------
    */

    if (!storeId) {

      console.warn(
        "Flutterwave webhook does not contain a store ID:",
        transactionReference
      )

      return res.status(200).json({

        received: true,

        processed: false,

        reason:
          "Store ID not found"

      })

    }


    /*
    --------------------------------
    FIND STORE
    --------------------------------
    */

    const store =
      await Store.findById(
        storeId
      )


    if (!store) {

      console.warn(
        "Store not found for Flutterwave webhook:",
        storeId
      )

      return res.status(200).json({

        received: true,

        processed: false,

        reason:
          "Store not found"

      })

    }


    /*
    --------------------------------
    EXTRACT PLAN
    --------------------------------
    */

    let planName =
      data.meta?.plan ||
      data.metadata?.plan ||
      null


    let billingCycle =
      data.meta?.billing_cycle ||
      data.metadata?.billing_cycle ||
      null


    /*
    --------------------------------
    PARSE PLAN FROM REFERENCE
    --------------------------------

    Expected:

    subscription_STOREID_basic_monthly

    subscription_STOREID_pro_yearly
    --------------------------------
    */

    if (
      transactionReference &&
      (
        !planName ||
        !billingCycle
      )
    ) {

      const match =
        transactionReference.match(
          /^subscription_[a-fA-F0-9]{24}_(free|basic|pro|premium)_(monthly|yearly)$/
        )


      if (match) {

        planName =
          planName ||
          match[1]

        billingCycle =
          billingCycle ||
          match[2]

      }

    }


    /*
    --------------------------------
    PLAN REQUIRED
    --------------------------------
    */

    if (!planName) {

      console.warn(
        "Flutterwave webhook missing plan:",
        transactionReference
      )

      return res.status(200).json({

        received: true,

        processed: false,

        reason:
          "Plan not found"

      })

    }


    /*
    --------------------------------
    NORMALIZE PLAN
    --------------------------------
    */

    planName =
      String(
        planName
      )
        .trim()
        .toLowerCase()


    const plan =
      getPlan(planName)


    if (!plan) {

      console.warn(
        "Invalid plan received:",
        planName
      )

      return res.status(200).json({

        received: true,

        processed: false,

        reason:
          "Invalid plan"

      })

    }


    /*
    --------------------------------
    NORMALIZE BILLING CYCLE
    --------------------------------
    */

    billingCycle =
      String(
        billingCycle ||
        "yearly"
      )
        .trim()
        .toLowerCase()


    if (
      billingCycle !== "monthly" &&
      billingCycle !== "yearly"
    ) {

      return res.status(200).json({

        received: true,

        processed: false,

        reason:
          "Invalid billing cycle"

      })

    }


    /*
    --------------------------------
    IDEMPOTENCY
    --------------------------------

    Prevent processing the same
    successful transaction twice.
    --------------------------------
    */

    if (
      transactionReference &&
      store.flutterwave_subscription_reference ===
        transactionReference &&
      store.subscription_status ===
        "active"
    ) {

      console.log(
        "Flutterwave webhook already processed:",
        transactionReference
      )

      return res.status(200).json({

        received: true,

        processed: false,

        duplicate: true

      })

    }


    /*
    --------------------------------
    CALCULATE RENEWAL DATE
    --------------------------------
    */

    const renewal =
      new Date()


    if (
      billingCycle === "monthly"
    ) {

      renewal.setMonth(
        renewal.getMonth() + 1
      )

    } else {

      renewal.setFullYear(
        renewal.getFullYear() + 1
      )

    }


    /*
    --------------------------------
    UPDATE SUBSCRIPTION
    --------------------------------
    */

    store.plan =
      planName


    store.subscription_status =
      "active"


    store.subscription_renewal =
      renewal


    store.billing_grace_until =
      null


    store.system_locked =
      false


    /*
    --------------------------------
    APPLY PLAN CONFIGURATION
    --------------------------------
    */

    store.monthly_order_limit =
      plan.monthly_order_limit


    store.transaction_fee =
      plan.transaction_fee


    /*
    --------------------------------
    STORE FLUTTERWAVE PAYMENT DATA
    --------------------------------
    */

    store.flutterwave_transaction_id =
      transactionId
        ? String(transactionId)
        : undefined


    store.flutterwave_subscription_reference =
      transactionReference ||
      undefined


    store.flutterwave_billing_cycle =
      billingCycle


    store.flutterwave_last_payment_at =
      new Date()


    /*
    --------------------------------
    RESET ORDER USAGE
    --------------------------------
    */

    store.orders_used =
      0


    /*
    --------------------------------
    SAVE STORE
    --------------------------------
    */

    await store.save()


    /*
    --------------------------------
    LOG SUCCESS
    --------------------------------
    */

    console.log(
      "Flutterwave subscription activated:",
      {
        storeId:
          store._id.toString(),

        plan:
          planName,

        billingCycle,

        renewal:
          renewal.toISOString(),

        transactionReference
      }
    )


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.status(200).json({

      received: true,

      processed: true,

      plan:
        planName,

      billing_cycle:
        billingCycle,

      subscription_status:
        "active"

    })

  } catch (error) {

    console.error(
      "Flutterwave webhook error:",
      error.response?.data ||
      error.message ||
      error
    )


    /*
    --------------------------------
    RETURN 500
    --------------------------------

    This allows Flutterwave to retry
    the webhook when our processing
    actually fails.
    --------------------------------
    */

    return res.status(500).json({

      error:
        "Webhook processing failed"

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

async function handleSubscriptionFailure(
  storeId
) {

  if (!storeId) {

    throw new Error(
      "Store ID is required"
    )

  }


  const store =
    await Store.findById(
      storeId
    )


  if (!store) {

    throw new Error(
      "Store not found"
    )

  }


  store.subscription_status =
    "past_due"


  /*
  --------------------------------
  BILLING GRACE PERIOD
  --------------------------------
  */

  const graceUntil =
    new Date()


  graceUntil.setDate(
    graceUntil.getDate() + 7
  )


  store.billing_grace_until =
    graceUntil


  await store.save()


  return store

}



/*
================================
HANDLE SUBSCRIPTION CANCELLATION
================================
*/

async function handleSubscriptionCancelled(
  storeId
) {

  if (!storeId) {

    throw new Error(
      "Store ID is required"
    )

  }


  const store =
    await Store.findById(
      storeId
    )


  if (!store) {

    throw new Error(
      "Store not found"
    )

  }


  store.subscription_status =
    "cancelled"


  store.billing_grace_until =
    null


  await store.save()


  return store

}



/*
================================
EXPORTS
================================
*/



/*
================================
WOOCOMMERCE WEBHOOK HELPERS
================================
*/

function normalizeWebhookStoreUrl(value) {
  try {
    const url = new URL(String(value || "").trim())

    return (
      url.origin.toLowerCase() +
      url.pathname.replace(/\/+$/, "").toLowerCase()
    )
  } catch {
    return null
  }
}


function getWooCustomerName(billing = {}) {
  return [
    billing.first_name,
    billing.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
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
      return "paid"

    case "cancelled":
    case "refunded":
      return "cancelled"

    default:
      return "new"
  }
}


function mapWooPaymentStatus(order) {
  const status = String(order.status || "").toLowerCase()

  if (status === "refunded") return "refunded"
  if (status === "failed") return "failed"
  if (status === "cancelled") return "cancelled"

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

The WooCommerce source header is not
trusted by itself. It is matched against
a connected store URL before the HMAC
signature is checked with that store's
stored webhook secret.
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
    const storedUrl =
      normalizeWebhookStoreUrl(
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

The phone fallback avoids violating
the model's unique store + phone index.
================================
*/

async function syncWooCommerceCustomer(store, wooOrder) {
  const billing = wooOrder.billing || {}

  const externalCustomerId =
    wooOrder.customer
      ? String(wooOrder.customer)
      : ""

  if (!externalCustomerId) {
    return null
  }

  const customerData = {
    name: getWooCustomerName(billing),
    email: String(billing.email || "")
      .trim()
      .toLowerCase(),
    phone: String(billing.phone || "").trim(),
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

  // The Customer model has a unique store_id + phone
  // index. Reuse an existing record rather than
  // causing a duplicate-key error.
  if (customerData.phone) {
    customer = await Customer.findOne({
      store_id: store._id,
      phone: customerData.phone
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

  const customer =
    await syncWooCommerceCustomer(store, wooOrder)

  const wooLineItems =
    Array.isArray(wooOrder.line_items)
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
    const externalProductId =
      String(item.product_id || "")

    const quantity =
      Math.max(1, Number(item.quantity) || 1)

    const unitPrice =
      Math.max(0, Number(item.price) || 0)

    return {
      product_id:
        productIdMap.get(externalProductId),

      external_product_id:
        externalProductId,

      name:
        item.name || "",

      sku:
        item.sku || "",

      quantity,

      unit_price:
        unitPrice,

      total_price:
        Math.max(0, Number(item.total) || 0)
    }
  })

  const orderStatus =
    mapWooOrderStatus(wooOrder.status)

  const paymentStatus =
    mapWooPaymentStatus(wooOrder)

  const orderData = {
    store_id: store._id,
    source: "woocommerce",
    external_id: String(wooOrder.id),

    order_number:
      String(wooOrder.number || wooOrder.id),

    customer_id:
      customer?._id,

    external_customer_id:
      wooOrder.customer
        ? String(wooOrder.customer)
        : "",

    customer_name:
      getWooCustomerName(billing),

    customer_email:
      String(billing.email || "")
        .trim()
        .toLowerCase(),

    customer_phone:
      String(billing.phone || "").trim(),

    customer_address:
      getWooCustomerAddress(billing),

    items,

    subtotal:
      Math.max(0, Number(wooOrder.subtotal) || 0),

    total_price:
      Math.max(0, Number(wooOrder.total) || 0),

    currency:
      String(wooOrder.currency || "USD").toUpperCase(),

    payment_status: paymentStatus,

    payment_reference:
      wooOrder.transaction_id || "",

    payment_transaction_id:
      wooOrder.transaction_id || "",

    payment_gateway:
      wooOrder.payment_method || "",

    order_status: orderStatus,

    ordered_at:
      wooOrder.date_created
        ? new Date(wooOrder.date_created)
        : new Date()
  }

  if (wooOrder.date_completed) {
    orderData.fulfilled_at =
      new Date(wooOrder.date_completed)
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

    const topic =
      String(
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

    const store =
      await findWooCommerceWebhookStore(sourceUrl)

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

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          store.woocommerce.webhook_secret
        )
        .update(rawBody)
        .digest("base64")

    const receivedBuffer =
      Buffer.from(String(signature))

    const expectedBuffer =
      Buffer.from(expectedSignature)

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

    console.log(
      "WooCommerce webhook received:",
      {
        store: store._id.toString(),
        topic,
        resource: req.headers["x-wc-webhook-resource"],
        id: payload.id
      }
    )

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

      const result =
        await syncWooProduct(store, payload.id)

      // Product may have been deleted between
      // WooCommerce's event and our API fetch.
      if (result.deleted) {
        await Product.deleteOne({
          store_id: store._id,
          source: "woocommerce",
          external_id: String(payload.id)
        })
      }

      store.woocommerce.last_product_sync =
        new Date()

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

      store.woocommerce.last_product_sync =
        new Date()

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
      const savedOrder =
        await syncWooCommerceOrder(store, payload)

      store.woocommerce.last_order_sync =
        new Date()

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

      store.woocommerce.last_order_sync =
        new Date()

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
      error.response?.data || error.message || error
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
'@

# Create a timestamped backup before replacing the current controller.
if (Test-Path $targetPath) {
    $backupPath = "$targetPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $targetPath -Destination $backupPath
    Write-Host "Backup created: $backupPath" -ForegroundColor Yellow
}

# Write UTF-8 without BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($targetPath, $controllerCode + [Environment]::NewLine, $utf8NoBom)

Write-Host "`nUpdated: $targetPath" -ForegroundColor Green

# Validate the new controller using Node.js.
Push-Location $projectPath
try {
    & node --check ".\controllers\webhookController.js"
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js syntax check failed. Your backup is preserved."
    }

    Write-Host "`nNode.js syntax check passed." -ForegroundColor Green

    # Also verify server.js syntax without modifying it.
    & node --check ".\server.js"
    if ($LASTEXITCODE -ne 0) {
        throw "server.js syntax check failed."
    }

    Write-Host "server.js syntax check passed." -ForegroundColor Green
}
finally {
    Pop-Location
}
