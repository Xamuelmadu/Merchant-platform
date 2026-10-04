const crypto = require("crypto")

const Store = require("../models/store")
const { getPlan } = require("../config/plan")



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

module.exports = {

  flutterwaveWebhook,

  handleSubscriptionFailure,

  handleSubscriptionCancelled

}