const Store = require("../models/store")
const Order = require("../models/Order")

const stripeService = require("../services/stripeService")
const paystackService = require("../services/paystackService")



/*
--------------------------------
GET BILLING INFO
--------------------------------
GET /billing
--------------------------------
*/

async function getBillingInfo(req,res){

  try{

    const store = req.store

    if(!store){
      return res.status(404).json({
        error:"Store not found"
      })
    }

    const stats = await Order.aggregate([
      { $match:{ store_id:store._id } },
      {
        $group:{
          _id:null,
          revenue:{ $sum:{ $ifNull:["$total_price",0] } },
          orders:{ $sum:1 }
        }
      }
    ])

    const revenue = stats?.[0]?.revenue || 0
    const orders = stats?.[0]?.orders || 0

    const feeRate = store.transaction_fee ?? 0.007

    const platformFees = revenue * feeRate

    res.json({

      plan:store.plan || "free",

      subscription_status:store.subscription_status || "inactive",

      subscription_renewal:store.subscription_renewal || null,

      revenue,

      orders,

      platform_fees:platformFees,

      net_earnings:revenue - platformFees

    })

  }catch(error){

    console.error("Billing info error:",error)

    res.status(500).json({
      error:"Billing fetch failed"
    })

  }

}



/*
--------------------------------
GET MONTHLY INVOICE
--------------------------------
GET /billing/invoice
--------------------------------
*/

async function getMonthlyInvoice(req,res){

  try{

    const store = req.store

    const stats = await Order.aggregate([
      { $match:{ store_id:store._id } },
      {
        $group:{
          _id:null,
          revenue:{ $sum:{ $ifNull:["$total_price",0] } }
        }
      }
    ])

    const revenue = stats?.[0]?.revenue || 0

    const feeRate = store.transaction_fee ?? 0.007

    const platformFees = revenue * feeRate

    res.json({

      month:new Date().toISOString().slice(0,7),

      revenue,

      platform_fees:platformFees,

      amount_due:platformFees,

      status:"pending"

    })

  }catch(error){

    console.error("Invoice error:",error)

    res.status(500).json({
      error:"Invoice fetch failed"
    })

  }

}



/*
--------------------------------
PAY INVOICE
--------------------------------
POST /billing/pay-invoice
--------------------------------
*/

async function payInvoice(req,res){

  try{

    const store = req.store

    const stats = await Order.aggregate([
      { $match:{ store_id:store._id } },
      {
        $group:{
          _id:null,
          revenue:{ $sum:{ $ifNull:["$total_price",0] } }
        }
      }
    ])

    const revenue = stats?.[0]?.revenue || 0

    const feeRate = store.transaction_fee ?? 0.007

    const fee = revenue * feeRate

    if(store.stripe_customer_id){

      await stripeService.chargeCustomer(
        store.stripe_customer_id,
        fee
      )

      return res.json({
        gateway:"stripe",
        amount:fee,
        status:"paid"
      })

    }

    if(store.paystack_authorization_code){

      await paystackService.chargeAuthorization(
        store.paystack_authorization_code,
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

    res.status(500).json({
      error:"Invoice payment failed"
    })

  }

}



/*
--------------------------------
GET BILLING HISTORY
--------------------------------
GET /billing/history
--------------------------------
*/

async function getBillingHistory(req,res){

  try{

    const store = req.store

    const orders = await Order.find({
      store_id:store._id
    })
    .sort({ createdAt:-1 })
    .limit(20)

    const history = orders.map(order => ({
      order_id:order._id,
      amount:order.total_price,
      date:order.createdAt
    }))

    res.json(history)

  }catch(error){

    console.error("Billing history error:",error)

    res.status(500).json({
      error:"History fetch failed"
    })

  }

}



/*
--------------------------------
UPGRADE PLAN
--------------------------------
POST /billing/upgrade
--------------------------------
*/

async function upgradePlan(req,res){

  try{

    const { plan, gateway="stripe" } = req.body

    const store = req.store

    const planPrices = {
      starter:0,
      growth:9500,
      scale:24000
    }

    const amount = planPrices[plan]

    if(amount === undefined){
      return res.status(400).json({
        error:"Invalid plan"
      })
    }

    if(gateway === "stripe"){

      if(!store.stripe_customer_id){

        const customer = await stripeService.createCustomer(
          req.user.email
        )

        store.stripe_customer_id = customer

        await store.save()

      }

      const checkout = await stripeService.createCheckoutSession(
        store.stripe_customer_id,
        plan
      )

      return res.json({
        gateway:"stripe",
        checkout_url:checkout
      })

    }

    if(gateway === "paystack"){

      const payment = await paystackService.createPaystackPayment({

        email:req.user.email,

        amount

      })

      return res.json({
        gateway:"paystack",
        payment_link:payment.payment_link
      })

    }

    return res.status(400).json({
      error:"Invalid gateway"
    })

  }catch(error){

    console.error("Upgrade plan error:",error)

    res.status(500).json({
      error:error.message
    })

  }

}



/*
--------------------------------
CHARGE PLATFORM FEES
--------------------------------
POST /billing/charge-fees
--------------------------------
*/

async function chargePlatformFees(req,res){

  try{

    const store = req.store

    const stats = await Order.aggregate([
      { $match:{ store_id:store._id } },
      {
        $group:{
          _id:null,
          revenue:{ $sum:{ $ifNull:["$total_price",0] } }
        }
      }
    ])

    const revenue = stats?.[0]?.revenue || 0

    const feeRate = store.transaction_fee ?? 0.007

    const fee = revenue * feeRate

    if(fee <= 0){
      return res.json({
        message:"No platform fees due"
      })
    }

    if(store.stripe_customer_id){

      await stripeService.chargeCustomer(
        store.stripe_customer_id,
        fee
      )

      return res.json({
        gateway:"stripe",
        amount:fee
      })

    }

    if(store.paystack_authorization_code){

      await paystackService.chargeAuthorization(
        store.paystack_authorization_code,
        fee,
        req.user.email
      )

      return res.json({
        gateway:"paystack",
        amount:fee
      })

    }

    return res.status(400).json({
      error:"No payment method available"
    })

  }catch(error){

    console.error("Charge fee error:",error)

    res.status(500).json({
      error:error.message
    })

  }

}



/*
--------------------------------
CANCEL SUBSCRIPTION
--------------------------------
POST /billing/cancel
--------------------------------
*/

async function cancelSubscription(req,res){

  try{

    const store = req.store

    store.subscription_status = "cancelled"

    await store.save()

    res.json({
      message:"Subscription cancelled"
    })

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



module.exports = {

  getBillingInfo,
  getMonthlyInvoice,
  payInvoice,
  getBillingHistory,
  upgradePlan,
  chargePlatformFees,
  cancelSubscription

}