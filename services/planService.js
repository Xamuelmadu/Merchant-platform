const { getStoreLimit } = require("../config/plans")
const Store = require("../models/store")

async function checkStoreLimit(userId, plan) {

  const currentCount = await Store.countDocuments({
    merchant_id: userId
  })

  const limit = getStoreLimit(plan)

  if (currentCount >= limit) {
    throw new Error(
      `Store limit reached (${limit}). Upgrade your plan.`
    )
  }

  return true
}

module.exports = {
  checkStoreLimit
}