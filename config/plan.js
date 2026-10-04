/*
================================
PLATFORM PLANS
================================

All subscription prices are stored
in USD.

Merchants can choose:

monthly
yearly

The yearly price includes a discount
compared with paying monthly for 12
months.
================================
*/

const PLANS = {

  /*
  --------------------------------
  FREE
  --------------------------------
  */

  free: {

    name:
      "Free",

    monthly_order_limit:
      20,

    store_limit:
      1,

    billing_cycle:
      "monthly",

    monthly_price:
      0,

    yearly_price:
      0,

    transaction_fee:
      0.007

  },


  /*
  --------------------------------
  BASIC
  --------------------------------
  */

  basic: {

    name:
      "Basic",

    monthly_order_limit:
      200,

    store_limit:
      2,

    monthly_price:
      15,

    yearly_price:
      144,

    transaction_fee:
      0.005

  },


  /*
  --------------------------------
  PRO
  --------------------------------
  */

  pro: {

    name:
      "Pro",

    monthly_order_limit:
      999999,

    store_limit:
      4,

    monthly_price:
      29,

    yearly_price:
      276,

    transaction_fee:
      0.0035

  },


  /*
  --------------------------------
  PREMIUM
  --------------------------------
  */

  premium: {

    name:
      "Premium",

    monthly_order_limit:
      999999,

    store_limit:
      6,

    monthly_price:
      59,

    yearly_price:
      564,

    transaction_fee:
      0.0025

  }

}


/*
================================
GET PLAN
================================
*/

function getPlan(
  planName = "free"
) {

  return (
    PLANS[
      String(planName)
        .toLowerCase()
        .trim()
    ] ||
    PLANS.free
  )

}


/*
================================
GET ORDER LIMIT
================================
*/

function getOrderLimit(
  planName
) {

  return getPlan(
    planName
  ).monthly_order_limit

}


/*
================================
GET TRANSACTION FEE
================================
*/

function getTransactionFee(
  planName
) {

  return getPlan(
    planName
  ).transaction_fee

}


/*
================================
GET STORE LIMIT
================================
*/

function getStoreLimit(
  planName
) {

  return getPlan(
    planName
  ).store_limit

}


/*
================================
GET PLAN PRICE
================================

Returns the price for the selected
billing cycle.

Supported cycles:

monthly
yearly
================================
*/

function getPlanPrice(
  planName,
  billingCycle = "monthly"
) {

  const plan =
    getPlan(planName)


  const cycle =
    String(
      billingCycle
    )
      .toLowerCase()
      .trim()


  if (
    cycle === "yearly"
  ) {

    return plan.yearly_price

  }


  return plan.monthly_price

}


/*
================================
GET BILLING CYCLE
================================
*/

function getBillingCycle(
  billingCycle = "monthly"
) {

  const cycle =
    String(
      billingCycle
    )
      .toLowerCase()
      .trim()


  return (
    cycle === "yearly"
      ? "yearly"
      : "monthly"
  )

}


/*
================================
GET PLAN BILLING DETAILS
================================

Useful for the subscription page
and billing controller.
================================
*/

function getPlanBilling(
  planName,
  billingCycle = "monthly"
) {

  const plan =
    getPlan(planName)

  const cycle =
    getBillingCycle(
      billingCycle
    )

  return {

    plan:
      String(planName)
        .toLowerCase()
        .trim(),

    name:
      plan.name,

    billing_cycle:
      cycle,

    price:
      getPlanPrice(
        planName,
        cycle
      ),

    monthly_price:
      plan.monthly_price,

    yearly_price:
      plan.yearly_price,

    monthly_order_limit:
      plan.monthly_order_limit,

    store_limit:
      plan.store_limit,

    transaction_fee:
      plan.transaction_fee

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  PLANS,

  getPlan,

  getOrderLimit,

  getTransactionFee,

  getStoreLimit,

  getPlanPrice,

  getBillingCycle,

  getPlanBilling

}