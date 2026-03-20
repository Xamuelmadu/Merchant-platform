const Store = require("../models/store")
const Order = require("../models/Order")



async function planGuard(req, res, next) {

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
    created_at: {
      $gte: startOfMonth
    }
  })



  if (ordersThisMonth >= 20) {
    return res.status(403).json({
      error: "Free plan limit reached. Please upgrade."
    })
  }



  return next()

}



module.exports = planGuard