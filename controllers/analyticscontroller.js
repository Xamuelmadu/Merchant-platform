const Order = require("../models/order")
const Customer = require("../models/customer")


/*
|--------------------------------------------------------------------------
| FINANCIAL SUMMARY
|--------------------------------------------------------------------------
|
| Returns the financial position of the currently
| active merchant store.
|
| Financial values are derived from the canonical
| order records rather than recalculating fees
| from the store's current transaction fee.
|
*/

async function getFinancialSummary(req, res) {

  try {

    const store = req.store


    /*
    |--------------------------------------------------------------------------
    | NO STORE
    |--------------------------------------------------------------------------
    */

    if (!store) {

      return res.json({

        revenue: 0,

        orders: 0,

        customers: 0,

        platform_fees: 0,

        net_earnings: 0

      })

    }



    /*
    |--------------------------------------------------------------------------
    | ORDER FINANCIALS
    |--------------------------------------------------------------------------
    */

    const orderStats =
      await Order.aggregate([

        {
          $match: {
            store_id: store._id
          }
        },

        {
          $group: {

            _id: null,

            revenue: {
              $sum: {
                $ifNull: [
                  "$total_price",
                  0
                ]
              }
            },

            orders: {
              $sum: 1
            },

            platform_fees: {
              $sum: {
                $ifNull: [
                  "$platform_fee",
                  0
                ]
              }
            },

            net_earnings: {
              $sum: {
                $ifNull: [
                  "$merchant_payout",
                  0
                ]
              }
            }

          }
        }

      ])



    const stats =
      orderStats?.[0] || {}



    const revenue =
      Number(
        stats.revenue || 0
      )


    const orders =
      Number(
        stats.orders || 0
      )


    const platformFees =
      Number(
        stats.platform_fees || 0
      )


    /*
    |--------------------------------------------------------------------------
    | NET EARNINGS FALLBACK
    |--------------------------------------------------------------------------
    |
    | Older orders may not have merchant_payout
    | stored. In that case, preserve the existing
    | calculation using the store fee.
    |
    */

    let netEarnings =
      Number(
        stats.net_earnings || 0
      )


    if (
      !stats.net_earnings &&
      revenue > 0
    ) {

      const feeRate =
        Number(
          store.transaction_fee || 0.02
        )


      const fallbackFees =
        revenue * feeRate


      /*
      If no canonical platform fees
      exist, use the historical fallback.
      */

      if (platformFees === 0) {

        netEarnings =
          revenue - fallbackFees

      } else {

        netEarnings =
          revenue - platformFees

      }

    }



    /*
    |--------------------------------------------------------------------------
    | CUSTOMERS
    |--------------------------------------------------------------------------
    */

    let customers = 0


    try {

      customers =
        await Customer.countDocuments({
          store_id: store._id
        })

    } catch (error) {

      console.error(
        "Customer count error:",
        error.message
      )

      customers = 0

    }



    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.json({

      revenue,

      orders,

      customers,

      platform_fees:
        platformFees > 0
          ? platformFees
          : (
              revenue *
              Number(
                store.transaction_fee || 0.02
              )
            ),

      net_earnings:
        netEarnings

    })

  } catch (error) {

    console.error(
      "Analytics error:",
      error
    )


    return res.status(500).json({

      error:
        "Unable to load financial summary"

    })

  }

}


module.exports = {
  getFinancialSummary
}