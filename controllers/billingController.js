const Store = require("../models/store")
const Order = require("../models/order")

const stripeService =
  require("../services/stripeService")

const flutterwaveService =
  require("../services/flutterwaveService")

const {
  getPlan
} = require("../config/plan")


/*
================================
HELPER: CALCULATE REVENUE
================================
*/

async function calculateRevenue(storeId) {

  const stats =
    await Order.aggregate([

      {
        $match: {
          store_id: storeId
        }
      },

      {
        $group: {

          _id: null,

          revenue: {
            $sum: {
              $ifNull: [
                "$total_price",
                0
              ]
            }
          },

          orders: {
            $sum: 1
          }

        }
      }

    ])


  return {

    revenue:
      stats?.[0]?.revenue || 0,

    orders:
      stats?.[0]?.orders || 0

  }

}


/*
================================
GET BILLING INFO
================================
*/

async function getBillingInfo(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    const {
      revenue,
      orders
    } =
      await calculateRevenue(
        req.store._id
      )


    const feeRate =
      req.store.transaction_fee ??
      0.007


    const platformFees =
      revenue * feeRate


    return res.json({

      plan:
        req.store.plan ||
        "free",

      subscription_status:
        req.store.subscription_status ||
        "inactive",

      subscription_renewal:
        req.store.subscription_renewal ||
        null,

      billing_cycle:
        req.store.billing_cycle ||
        null,

      revenue,

      orders,

      platform_fees:
        platformFees,

      net_earnings:
        revenue - platformFees

    })

  } catch (error) {

    console.error(
      "Billing info error:",
      error
    )


    return res.status(500).json({
      error: "Billing fetch failed"
    })

  }

}


/*
================================
GET INVOICE
================================
*/

async function getMonthlyInvoice(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    const {
      revenue
    } =
      await calculateRevenue(
        req.store._id
      )


    const feeRate =
      req.store.transaction_fee ??
      0.007


    const platformFees =
      revenue * feeRate


    return res.json({

      period:
        new Date()
          .toISOString()
          .slice(0, 7),

      revenue,

      platform_fees:
        platformFees,

      amount_due:
        platformFees,

      status:
        "pending"

    })

  } catch (error) {

    console.error(
      "Invoice error:",
      error
    )


    return res.status(500).json({
      error: "Invoice fetch failed"
    })

  }

}


/*
================================
PAY INVOICE
================================

Platform transaction fees are separate
from subscription billing.

Existing Stripe / Paystack merchant
authorization logic is preserved here.
================================
*/

async function payInvoice(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    const {
      revenue
    } =
      await calculateRevenue(
        req.store._id
      )


    const feeRate =
      req.store.transaction_fee ??
      0.007


    const fee =
      revenue * feeRate


    if (fee <= 0) {

      return res.json({
        message: "No invoice due"
      })

    }


    /*
    --------------------------------
    STRIPE
    --------------------------------
    */

    if (
      req.store.stripe_customer_id
    ) {

      await stripeService.chargeCustomer(
        req.store.stripe_customer_id,
        fee
      )


      return res.json({

        gateway:
          "stripe",

        amount:
          fee,

        status:
          "paid"

      })

    }


    /*
    --------------------------------
    PAYSTACK
    --------------------------------
    */

    if (
      req.store.paystack_authorization_code
    ) {

      await paystackService.chargeAuthorization(
        req.store.paystack_authorization_code,
        fee,
        req.user.email
      )


      return res.json({

        gateway:
          "paystack",

        amount:
          fee,

        status:
          "paid"

      })

    }


    return res.status(400).json({
      error: "No payment method available"
    })

  } catch (error) {

    console.error(
      "Invoice payment error:",
      error
    )


    return res.status(500).json({
      error: "Invoice payment failed"
    })

  }

}


/*
================================
GET BILLING HISTORY
================================
*/

async function getBillingHistory(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    const orders =
      await Order.find({

        store_id:
          req.store._id,

        payment_status:
          "paid"

      })
        .sort({
          created_at: -1
        })
        .limit(20)


    const history =
      orders.map(
        order => ({

          id:
            order._id,

          amount:
            order.total_price,

          fee:
            order.platform_fee,

          net:
            order.merchant_payout,

          currency:
            order.currency,

          date:
            order.created_at

        })
      )


    return res.json(
      history
    )

  } catch (error) {

    console.error(
      "Billing history error:",
      error
    )


    return res.status(500).json({
      error: "History fetch failed"
    })

  }

}


/*
================================
CREATE SUBSCRIPTION PAYMENT
================================

Flutterwave is the subscription
checkout gateway.

The subscription amount is always
charged in USD.

The merchant store's Shopify /
WooCommerce payment gateway is NOT
used here.
================================
*/

async function upgradePlan(req, res) {

  try {

    const {
      plan,
      billing_cycle = "yearly"
    } =
      req.body


    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    /*
    --------------------------------
    VALIDATE PLAN
    --------------------------------
    */

    const planConfig =
      getPlan(plan)


    if (!planConfig) {

      return res.status(400).json({
        error: "Invalid plan"
      })

    }


    /*
    --------------------------------
    NORMALIZE BILLING CYCLE
    --------------------------------
    */

    const cycle =
      String(
        billing_cycle
      )
        .trim()
        .toLowerCase()


    if (
      cycle !== "monthly" &&
      cycle !== "yearly"
    ) {

      return res.status(400).json({

        error:
          "Invalid billing cycle",

        allowed:
          [
            "monthly",
            "yearly"
          ]

      })

    }


    /*
    --------------------------------
    FREE PLAN
    --------------------------------
    */

    if (
      plan === "free" ||
      planConfig.price === 0
    ) {

      req.store.plan =
        "free"

      req.store.subscription_status =
        "active"

      req.store.billing_cycle =
        cycle

      req.store.subscription_renewal =
        null

      req.store.system_locked =
        false

      await req.store.save()


      return res.json({

        success:
          true,

        plan:
          "free",

        billing_cycle:
          cycle,

        status:
          "active",

        message:
          "Free plan activated"

      })

    }


    /*
    --------------------------------
    GET CORRECT PRICE
    --------------------------------

    Plan configuration supports
    monthly and yearly pricing.

    Example:

    plan.price.monthly
    plan.price.yearly
    --------------------------------
    */

    let amount


    if (
      typeof planConfig.price === "object"
    ) {

      amount =
        Number(
          planConfig.price[cycle]
        )

    } else {

      /*
      Backward compatibility.

      If an older plan configuration
      contains a single numeric price,
      use that value.
      */

      amount =
        Number(
          planConfig.price
        )

    }


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      return res.status(400).json({

        error:
          "Invalid subscription price"

      })

    }


    /*
    --------------------------------
    USER EMAIL
    --------------------------------
    */

    const email =
      req.user?.email ||
      req.store?.email


    if (!email) {

      return res.status(400).json({

        error:
          "A valid email is required for subscription payment"

      })

    }


    /*
    --------------------------------
    FLUTTERWAVE SUBSCRIPTION
    --------------------------------

    Flutterwave receives USD.

    This is platform subscription
    billing, not merchant checkout.
    --------------------------------
    */

    const reference =
      `subscription_${req.store._id}_${Date.now()}`


    const response =
      await flutterwaveService.createFlutterwavePayment({

        _id:
          reference,

        total_price:
          amount,

        currency:
          "USD",

        customer_email:
          email,

        customer_phone:
          req.user?.phone ||
          "",

        customer_name:
          req.user?.name ||
          req.user?.full_name ||
          "Merchant"

      })


    /*
    --------------------------------
    SAVE PENDING SUBSCRIPTION
    --------------------------------

    Do NOT activate the plan yet.

    The plan becomes active only after
    Flutterwave payment verification /
    webhook confirmation.
    --------------------------------
    */

    req.store.pending_plan =
      plan

    req.store.pending_billing_cycle =
      cycle

    req.store.pending_subscription_reference =
      response.reference

    await req.store.save()


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success:
        true,

      gateway:
        "flutterwave",

      plan,

      billing_cycle:
        cycle,

      amount,

      currency:
        "USD",

      payment_link:
        response.payment_link,

      payment_reference:
        response.reference,

      status:
        "pending"

    })

  } catch (error) {

    console.error(
      "Upgrade plan error:",
      error.response?.data ||
      error.message ||
      error
    )


    return res.status(500).json({

      error:
        error.message ||
        "Unable to create subscription payment"

    })

  }

}


/*
================================
CHARGE PLATFORM FEES
================================
*/

async function chargePlatformFees(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    const {
      revenue
    } =
      await calculateRevenue(
        req.store._id
      )


    const feeRate =
      req.store.transaction_fee ??
      0.007


    const fee =
      revenue * feeRate


    if (fee <= 0) {

      return res.json({
        message: "No platform fees due"
      })

    }


    /*
    --------------------------------
    STRIPE
    --------------------------------
    */

    if (
      req.store.stripe_customer_id
    ) {

      await stripeService.chargeCustomer(
        req.store.stripe_customer_id,
        fee
      )


      return res.json({

        gateway:
          "stripe",

        amount:
          fee,

        status:
          "charged"

      })

    }


    /*
    --------------------------------
    PAYSTACK
    --------------------------------
    */

    if (
      req.store.paystack_authorization_code
    ) {

      await paystackService.chargeAuthorization(
        req.store.paystack_authorization_code,
        fee,
        req.user.email
      )


      return res.json({

        gateway:
          "paystack",

        amount:
          fee,

        status:
          "charged"

      })

    }


    return res.status(400).json({
      error: "No payment method available"
    })

  } catch (error) {

    console.error(
      "Platform fee charge error:",
      error
    )


    return res.status(500).json({
      error: "Platform fee charge failed"
    })

  }

}


/*
================================
CANCEL SUBSCRIPTION
================================
*/

async function cancelSubscription(req, res) {

  try {

    if (!req.store) {

      return res.status(404).json({
        error: "Store not found"
      })

    }


    req.store.subscription_status =
      "cancelled"


    await req.store.save()


    return res.json({

      success:
        true,

      message:
        "Subscription cancelled"

    })

  } catch (error) {

    console.error(
      "Cancel subscription error:",
      error
    )


    return res.status(500).json({
      error: error.message
    })

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  getBillingInfo,

  getMonthlyInvoice,

  payInvoice,

  getBillingHistory,

  upgradePlan,

  cancelSubscription,

  chargePlatformFees

}