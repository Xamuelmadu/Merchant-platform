const PLANS = {
  free: {
    name: "Free",
    monthly_order_limit: 20,
    store_limit: 1,
    billing_cycle: "yearly",
    price: 0,
    transaction_fee: 0.007
  },

  basic: {
    name: "Basic",
    monthly_order_limit: 200,
    store_limit: 2,
    billing_cycle: "yearly",
    price: 126000,
    transaction_fee: 0.005
  },

  pro: {
    name: "Pro",
    monthly_order_limit: 999999,
    store_limit: 4,
    billing_cycle: "yearly",
    price: 246000,
    transaction_fee: 0.0035
  },

  premium: {
    name: "Premium",
    monthly_order_limit: 999999,
    store_limit: 6,
    billing_cycle: "yearly",
    price: 468000,
    transaction_fee: 0.0025
  }
}

/*
--------------------------------
HELPERS (SAFE ACCESS)
--------------------------------
*/

function getPlan(planName = "free") {
  return PLANS[planName?.toLowerCase()] || PLANS.free
}

function getOrderLimit(planName) {
  return getPlan(planName).monthly_order_limit
}

function getTransactionFee(planName) {
  return getPlan(planName).transaction_fee
}

function getStoreLimit(planName) {
  return getPlan(planName).store_limit
}

function getPlanPrice(planName) {
  return getPlan(planName).price
}

function getBillingCycle(planName) {
  return getPlan(planName).billing_cycle
}

module.exports = {
  PLANS,
  getPlan,
  getOrderLimit,
  getTransactionFee,
  getStoreLimit,
  getPlanPrice,
  getBillingCycle
}