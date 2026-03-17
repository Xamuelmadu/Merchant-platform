const Order = require("../models/Order")

async function paystackWebhook(req,res){

  try{

    const event = req.body

    if(event.event === "charge.success"){

      const reference = event.data.reference

      const order = await Order.findOne({
        payment_reference:reference
      })

      if(order){

        order.payment_status = "paid"
        order.order_status = "confirmed"

        await order.save()

        console.log("Order payment confirmed:",order._id)

      }

    }

    res.sendStatus(200)

  }catch(error){

    console.error("Webhook error:",error.message)

    res.sendStatus(500)

  }

}

module.exports = { paystackWebhook }