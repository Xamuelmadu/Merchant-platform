const Store = require("../models/store") // ✅ fixed casing

async function checkUsageLimit(merchantId) {

  if (!merchantId) {
    throw new Error("Missing merchantId")
  }

  const store = await Store.findOne({
    merchant_id: merchantId
  })

  if (!store) {
    throw new Error("Store not found")
  }

  /*
  --------------------------------
  PLAN LIMIT CHECK
  --------------------------------
  */

  // Ensure safe defaults (prevents undefined crashes)
  const monthlyLimit = store.monthly_order_limit || 0
  const ordersUsed = store.orders_used || 0

  if (monthlyLimit > 0 && ordersUsed >= monthlyLimit) {
    throw new Error(
      "Monthly order limit reached. Please upgrade your plan."
    )
  }

  return store
}

module.exports = { checkUsageLimit }