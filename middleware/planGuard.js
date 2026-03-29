const Store = require("../models/store")
const Order = require("../models/order")



async function planGuard(req, res, next) {
  try {
    const store = await Store.findOne({
      merchant_id: req.user.id
    })

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    if (store.plan !== "free") {
      return next()
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)

    const ordersThisMonth = await Order.countDocuments({
      store_id: store._id,
      createdAt: { $gte: startOfMonth } // ✅ fixed
    })

    if (ordersThisMonth >= 20) {
      return res.status(403).json({
        error: "Free plan limit reached. Please upgrade."
      })
    }

    return next()

  } catch (error) {
    console.error("Plan guard error:", error.message)

    return res.status(500).json({
      error: "Plan validation failed"
    })
  }
}

module.exports = planGuard