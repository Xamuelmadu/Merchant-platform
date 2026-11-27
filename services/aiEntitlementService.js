const User = require("../models/user")

const PAID_PLANS = ["basic", "pro", "premium"]

async function reserveConversationCredit(store) {
  if (!store || !store._id || !store.merchant_id) {
    const error = new Error("Store not found")
    error.status = 404
    throw error
  }

  const now = new Date()

  // Paid entitlement belongs to this specific store.
  const paidSubscriptionActive =
    PAID_PLANS.includes(
      String(store.plan || "").toLowerCase()
    ) &&
    store.subscription_status === "active" &&
    store.subscription_renewal &&
    new Date(store.subscription_renewal).getTime() >
      now.getTime()

  if (paidSubscriptionActive) {
    return {
      type: "paid",
      plan: store.plan
    }
  }

  // Registration trial belongs to the merchant.
  const trialUser = await User.exists({
    _id: store.merchant_id,
    trial_status: "active",
    trial_ends_at: { $gt: now }
  })

  if (trialUser) {
    return { type: "trial" }
  }

  const error = new Error(
    "Your trial has expired. An active subscription is required."
  )

  error.status = 403
  error.code = "SUBSCRIPTION_REQUIRED"

  throw error
}

module.exports = {
  reserveConversationCredit
}