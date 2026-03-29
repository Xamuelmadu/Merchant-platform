const Store = require("../models/store")

async function checkSubscription(req, res, next) {
  try {
    const store = await Store.findOne({
      merchant_id: req.user.id
    })

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    if (store.system_locked) {
      return res.status(403).json({
        error: "Subscription expired. Please pay invoice."
      })
    }

    return next()

  } catch (error) {
    console.error("Subscription check error:", error.message)

    return res.status(500).json({
      error: "Subscription validation failed"
    })
  }
}

module.exports = checkSubscription