const Store = require("../models/Store")
const Order = require("../models/Order")
const Customer = require("../models/Customer")

async function getFinancialSummary(req, res) {

  try {

    const store = req.store

    if (!store) {
      return res.json({
        revenue: 0,
        orders: 0,
        customers: 0,
        platform_fees: 0,
        net_earnings: 0
      })
    }

    const orderStats = await Order.aggregate([
      {
        $match: { store_id: store._id }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total_price" },
          orders: { $sum: 1 }
        }
      }
    ])

    const revenue = orderStats?.[0]?.revenue || 0
    const orders = orderStats?.[0]?.orders || 0

    let customers = 0

    try {
      customers = await Customer.countDocuments({
        store_id: store._id
      })
    } catch (err) {
      customers = 0
    }

    const feeRate = store.transaction_fee || 0.02

    const platformFees = revenue * feeRate
    const netEarnings = revenue - platformFees

    return res.json({
      revenue,
      orders,
      customers,
      platform_fees: platformFees,
      net_earnings: netEarnings
    })

  } catch (error) {

    console.error("Analytics error:", error)

    return res.json({
      revenue: 0,
      orders: 0,
      customers: 0,
      platform_fees: 0,
      net_earnings: 0
    })

  }

}

module.exports = {
  getFinancialSummary
}