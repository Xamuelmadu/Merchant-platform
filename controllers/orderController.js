const Store = require("../models/Store")
const Product = require("../models/Product")
const Order = require("../models/Order")

const { processPayment } = require("../services/paymentRouter")
const { sendWhatsAppMessage } = require("../services/whatsappService")

const { checkUsageLimit } = require("../services/usageGuard")
const { enforceSubscription } = require("../services/subscriptionGuard")



/*
--------------------------------
CREATE ORDER
--------------------------------
*/

async function createOrder(req,res){

  try{

    const {
      product_id,
      quantity = 1,
      customer_name,
      customer_phone,
      customer_address,
      gateway = "paystack"
    } = req.body


    if(!product_id){
      return res.status(400).json({
        error:"product_id is required"
      })
    }


    /*
    --------------------------------
    SUBSCRIPTION GUARD
    --------------------------------
    */

    await enforceSubscription(req.user.id)


    /*
    --------------------------------
    PLAN LIMIT GUARD (FREE PLAN 20)
    --------------------------------
    */

    const store = await checkUsageLimit(req.user.id)



    /*
    --------------------------------
    FIND PRODUCT
    --------------------------------
    */

    const product = await Product.findOne({
      _id:product_id,
      store_id:store._id
    })

    if(!product){
      return res.status(404).json({
        error:"Product not found"
      })
    }



    /*
    --------------------------------
    CALCULATE TOTALS
    --------------------------------
    */

    const total = product.price * quantity

    const feeRate = store.transaction_fee ?? 0.007

    const platformFee = total * feeRate

    const merchantPayout = total - platformFee



    /*
    --------------------------------
    CREATE ORDER
    --------------------------------
    */

    const order = await Order.create({

      store_id:store._id,
      product_id,
      quantity,
      customer_name,
      customer_phone,
      customer_address,

      total_price:total,
      platform_fee:platformFee,
      merchant_payout:merchantPayout,

      payment_status:"pending",

      /*
      order_status flow
      new → paid → completed
      */

      order_status:"new"

    })



    /*
    --------------------------------
    SEND WHATSAPP NOTIFICATION
    --------------------------------
    */

    try{

      const message = `
🛒 New Order

Customer: ${customer_name}
Product: ${product.name}
Quantity: ${quantity}
Amount: ₦${total}
Payment: Pending
`

      await sendWhatsAppMessage(
        store.whatsapp_number,
        message
      )

    }catch(err){

      console.error("WhatsApp notification failed:",err.message)

    }



    /*
    --------------------------------
    UPDATE STORE USAGE
    --------------------------------
    */

    store.orders_used += 1

    await store.save()



    /*
    --------------------------------
    PROCESS PAYMENT
    --------------------------------
    */

    const payment = await processPayment(gateway, order)



    /*
    --------------------------------
    SAVE PAYMENT REFERENCE
    --------------------------------
    */

    order.payment_reference = payment.reference

    await order.save()



    res.json({

      message:"Order created successfully",

      order,

      payment_gateway:gateway,

      payment_link:payment.payment_link

    })


  }catch(error){

    console.error("Create order error:",error.message)

    res.status(500).json({

      error:"Order creation failed",

      details:error.message

    })

  }

}



/*
--------------------------------
GET ALL ORDERS
--------------------------------
*/

async function getOrders(req,res){

  try{

    const store = req.store

    const orders = await Order
      .find({ store_id:store._id })
      .populate("product_id")
      .sort({ created_at:-1 })


    res.json(orders)

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



/*
--------------------------------
GET SINGLE ORDER
--------------------------------
*/

async function getOrderById(req,res){

  try{

    const store = req.store

    const order = await Order
      .findOne({
        _id:req.params.id,
        store_id:store._id
      })
      .populate("product_id")


    if(!order){
      return res.status(404).json({
        error:"Order not found"
      })
    }


    res.json(order)

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



/*
--------------------------------
UPDATE ORDER STATUS
--------------------------------
Used for:
- admin completion
- bank transfer confirmation
--------------------------------
*/

async function updateOrderStatus(req,res){

  try{

    const { status } = req.body

    const validStatuses = [
      "new",
      "paid",
      "completed",
      "cancelled"
    ]

    if(!validStatuses.includes(status)){
      return res.status(400).json({
        error:"Invalid status"
      })
    }


    const order = await Order.findById(req.params.id)

    if(!order){
      return res.status(404).json({
        error:"Order not found"
      })
    }


    order.order_status = status

    /*
    mark payment if completed
    */

    if(status === "completed"){
      order.payment_status = "paid"
    }

    await order.save()


    res.json({

      message:"Order status updated",

      order

    })

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



/*
--------------------------------
RECENT COMPLETED ORDERS
--------------------------------
Used by financial dashboard
--------------------------------
*/

async function getRecentOrders(req,res){

  try{

    const store = req.store

    const orders = await Order.find({

      store_id:store._id,

      /*
      Only completed orders count as revenue
      */

      order_status:"completed"

    })
    .sort({ created_at:-1 })
    .limit(20)


    res.json(orders)

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



module.exports = {

  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getRecentOrders

}