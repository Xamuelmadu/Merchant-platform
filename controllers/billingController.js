const Store = require("../models/store")
const Order = require("../models/order")

const stripeService = require("../services/stripeService")
const paystackService = require("../services/paystackService")

const { getPlan } = require("../config/plan")



/*
--------------------------------
HELPER: CALCULATE REVENUE
--------------------------------
*/
async function calculateRevenue(storeId){

  const stats = await Order.aggregate([
    { $match:{ store_id:storeId } },
    {
      $group:{
        _id:null,
        revenue:{ $sum:{ $ifNull:["$total_price",0] } },
        orders:{ $sum:1 }
      }
    }
  ])

  return {
    revenue: stats?.[0]?.revenue || 0,
    orders: stats?.[0]?.orders || 0
  }

}



/*
--------------------------------
GET BILLING INFO
--------------------------------
*/
async function getBillingInfo(req,res){

  try{

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    const { revenue, orders } =
      await calculateRevenue(req.store._id)

    const feeRate = req.store.transaction_fee ?? 0.007

    const platformFees = revenue * feeRate

    res.json({

      plan:req.store.plan || "free",
      subscription_status:req.store.subscription_status || "inactive",
      subscription_renewal:req.store.subscription_renewal || null,

      revenue,
      orders,

      platform_fees:platformFees,
      net_earnings:revenue - platformFees

    })

  }catch(error){

    console.error("Billing info error:",error)
    res.status(500).json({ error:"Billing fetch failed" })

  }

}



/*
--------------------------------
GET INVOICE (CURRENT PERIOD)
--------------------------------
*/
async function getMonthlyInvoice(req,res){

  try{

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    const { revenue } =
      await calculateRevenue(req.store._id)

    const feeRate = req.store.transaction_fee ?? 0.007
    const platformFees = revenue * feeRate

    res.json({

      period: new Date().toISOString().slice(0,7),

      revenue,
      platform_fees:platformFees,
      amount_due:platformFees,

      status:"pending"

    })

  }catch(error){

    console.error("Invoice error:",error)
    res.status(500).json({ error:"Invoice fetch failed" })

  }

}



/*
--------------------------------
PAY INVOICE
--------------------------------
*/
async function payInvoice(req,res){

  try{

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    const { revenue } =
      await calculateRevenue(req.store._id)

    const feeRate = req.store.transaction_fee ?? 0.007
    const fee = revenue * feeRate

    if(fee <= 0){
      return res.json({ message:"No invoice due" })
    }

    /*
    STRIPE
    */
    if(req.store.stripe_customer_id){

      await stripeService.chargeCustomer(
        req.store.stripe_customer_id,
        fee
      )

      return res.json({
        gateway:"stripe",
        amount:fee,
        status:"paid"
      })

    }

    /*
    PAYSTACK
    */
    if(req.store.paystack_authorization_code){

      await paystackService.chargeAuthorization(
        req.store.paystack_authorization_code,
        fee,
        req.user.email
      )

      return res.json({
        gateway:"paystack",
        amount:fee,
        status:"paid"
      })

    }

    return res.status(400).json({
      error:"No payment method available"
    })

  }catch(error){

    console.error("Invoice payment error:",error)
    res.status(500).json({ error:"Invoice payment failed" })

  }

}



/*
--------------------------------
BILLING HISTORY
--------------------------------
*/
async function getBillingHistory(req,res){

  try{

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    const orders = await Order.find({
      store_id:req.store._id,
      payment_status:"paid"
    })
    .sort({ createdAt:-1 })
    .limit(20)

    const history = orders.map(order => ({
      id:order._id,
      amount:order.total_price,
      fee:order.platform_fee,
      net:order.merchant_payout,
      date:order.createdAt
    }))

    res.json(history)

  }catch(error){

    console.error("Billing history error:",error)
    res.status(500).json({ error:"History fetch failed" })

  }

}



/*
--------------------------------
UPGRADE PLAN (YEARLY FIXED)
--------------------------------
*/
async function upgradePlan(req,res){

  try{

    const { plan, gateway="paystack" } = req.body

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    const planConfig = getPlan(plan)

    if(!planConfig){
      return res.status(400).json({
        error:"Invalid plan"
      })
    }

    const amount = planConfig.price // yearly now

    /*
    PAYSTACK
    */
    if(gateway === "paystack"){

      const payment =
        await paystackService.createPaystackPayment({

          email:req.user.email,
          amount

        })

      return res.json({
        gateway:"paystack",
        payment_link:payment.payment_link
      })

    }

    /*
    STRIPE
    */
    if(gateway === "stripe"){

      if(!req.store.stripe_customer_id){

        const customer =
          await stripeService.createCustomer(req.user.email)

        req.store.stripe_customer_id = customer
        await req.store.save()

      }

      const checkout =
        await stripeService.createCheckoutSession(
          req.store.stripe_customer_id,
          plan
        )

      return res.json({
        gateway:"stripe",
        checkout_url:checkout
      })

    }

    return res.status(400).json({
      error:"Invalid gateway"
    })

  }catch(error){

    console.error("Upgrade error:",error)
    res.status(500).json({ error:error.message })

  }

}



/*
--------------------------------
CANCEL SUBSCRIPTION
--------------------------------
*/
async function cancelSubscription(req,res){

  try{

    if(!req.store){
      return res.status(404).json({ error:"Store not found" })
    }

    req.store.subscription_status = "cancelled"

    await req.store.save()

    res.json({ message:"Subscription cancelled" })

  }catch(error){

    res.status(500).json({ error:error.message })

  }

}



module.exports = {

  getBillingInfo,
  getMonthlyInvoice,
  payInvoice,
  getBillingHistory,
  upgradePlan,
  cancelSubscription

}