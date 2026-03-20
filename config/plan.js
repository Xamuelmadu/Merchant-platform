const plans = {

  free:{
    monthly_order_limit:20,
    transaction_fee:0.007,
    price:0
  },

  starter:{
    monthly_order_limit:200,
    transaction_fee:0.005,
    price:10500
  },

  pro:{
    monthly_order_limit:999999,
    transaction_fee:0.0035,
    price:20500
  },

  business:{
    monthly_order_limit:999999,
    transaction_fee:0.0025,
    price:39000
  }

}

function getStoreLimit(plan) {
  return plans[plan]?.monthly_order_limit ?? plans.free.monthly_order_limit
}

function getPlan(plan) {
  return plans[plan] ?? plans.free
}

module.exports = {
  ...plans,
  getStoreLimit,
  getPlan
}