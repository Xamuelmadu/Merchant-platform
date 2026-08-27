const Store = require("../models/store")
const Product = require("../models/product")
const Order = require("../models/order")

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

/*
--------------------------------
INTERNAL AI ORDER CREATION
--------------------------------

Used by the AI Engine.

The Engine does not have merchant
JWT authentication, so this endpoint
uses the internal platform key.

This creates the canonical order
inside the Merchant Platform.
--------------------------------
*/

async function createInternalOrder(req, res) {

  try {

    /*
    --------------------------------
    INTERNAL AUTH
    --------------------------------
    */

    const platformKey =
      req.headers["x-platform-key"]

    if (
      !process.env.AI_COMMERCE_PLATFORM_KEY ||
      platformKey !==
        process.env.AI_COMMERCE_PLATFORM_KEY
    ) {

      return res.status(401).json({

        success: false,

        error:
          "Unauthorized platform request"

      })

    }


    /*
    --------------------------------
    REQUEST DATA
    --------------------------------
    */

    const {

      store_id,

      product_id,

      quantity = 1,

      customer_id,

      external_customer_id,

      customer_name = "",

      customer_email = "",

      customer_phone = "",

      customer_address = "",

      source = "custom",

      gateway = "paystack"

    } = req.body


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!store_id) {

      return res.status(400).json({

        success: false,

        error:
          "store_id is required"

      })

    }


    if (!product_id) {

      return res.status(400).json({

        success: false,

        error:
          "product_id is required"

      })

    }


    const parsedQuantity =
      Number(quantity)


    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity < 1
    ) {

      return res.status(400).json({

        success: false,

        error:
          "quantity must be a positive integer"

      })

    }


    const validSources = [
      "shopify",
      "woocommerce",
      "custom",
      "manual"
    ]


    if (
      !validSources.includes(
        source
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid order source"

      })

    }


    /*
    --------------------------------
    FIND STORE
    --------------------------------
    */

    const store =
      await Store.findById(
        store_id
      )


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

      })

    }


    /*
    --------------------------------
    FIND PRODUCT
    --------------------------------
    */

    const product =
      await Product.findOne({

        _id:
          product_id,

        store_id:
          store._id

      })


    if (!product) {

      return res.status(404).json({

        success: false,

        error:
          "Product not found"

      })

    }


    /*
    --------------------------------
    INVENTORY CHECK
    --------------------------------
    */

    if (
      Number(product.stock) <
      parsedQuantity
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Insufficient product stock",

        available_stock:
          Number(product.stock)

      })

    }


    /*
    --------------------------------
    CALCULATE TOTALS
    --------------------------------
    */

    const unitPrice =
      Number(product.price) || 0


    const subtotal =
      unitPrice *
      parsedQuantity


    const total =
      subtotal


    const feeRate =
      store.transaction_fee ??
      0.007


    const platformFee =
      total *
      feeRate


    const merchantPayout =
      total -
      platformFee


    /*
    --------------------------------
    CREATE ORDER
    --------------------------------
    */

    const order =
      await Order.create({

        store_id:
          store._id,

        source,

        customer_id:
          customer_id || undefined,

        external_customer_id:
          external_customer_id ||
          "",

        customer_name,

        customer_email,

        customer_phone,

        customer_address,

        items: [

          {

            product_id:
              product._id,

            external_product_id:
              product.external_id ||
              "",

            name:
              product.name,

            quantity:
              parsedQuantity,

            unit_price:
              unitPrice,

            total_price:
              subtotal

          }

        ],

        /*
        Legacy compatibility
        */

        product_id:
          product._id,

        quantity:
          parsedQuantity,

        subtotal,

        total_price:
          total,

        currency:
          product.currency ||
          "USD",

        platform_fee:
          platformFee,

        merchant_payout:
          merchantPayout,

        payment_status:
          "pending",

        order_status:
          "new",

        ordered_at:
          new Date()

      })


    /*
    --------------------------------
    UPDATE STORE USAGE
    --------------------------------
    */

    store.orders_used =
      (store.orders_used || 0) + 1

    await store.save()


    /*
    --------------------------------
    PROCESS PAYMENT
    --------------------------------
    */

    let payment = null


    try {

      payment =
        await processPayment(
          gateway,
          order
        )


      if (
        payment?.reference
      ) {

        order.payment_reference =
          payment.reference

        await order.save()

      }

    } catch (paymentError) {

      console.error(
        "Internal order payment error:",
        paymentError.message
      )

      /*
      Keep the order.

      Payment can be retried without
      losing the order itself.
      */

      return res.status(201).json({

        success: true,

        payment_required:
          true,

        payment_error:
          paymentError.message,

        order

      })

    }


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.status(201).json({

      success: true,

      message:
        "Order created successfully",

      order,

      payment_gateway:
        gateway,

      payment_link:
        payment?.payment_link ||
        payment?.authorization_url ||
        null,

      payment_reference:
        payment?.reference ||
        order.payment_reference ||
        null

    })

  } catch (error) {

    console.error(
      "Internal order creation error:",
      error
    )


    return res.status(500).json({

      success: false,

      error:
        "Order creation failed",

      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error.message

    })

  }

}

module.exports = {

  createOrder,

  createInternalOrder,

  getOrders,

  getOrderById,

  updateOrderStatus,

  getRecentOrders

}
