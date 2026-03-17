const Store = require("../models/Store")



/*
--------------------------------
STRIPE WEBHOOK
--------------------------------
*/

async function handleStripeWebhook(req, res){

  try{

    const event = req.body

    console.log("Stripe webhook received:", event.type)

    /*
    SUBSCRIPTION CREATED
    */

    if(event.type === "checkout.session.completed"){

      const session = event.data.object

      const customerId = session.customer

      const store = await Store.findOne({
        stripe_customer_id: customerId
      })

      if(store){

        store.subscription_status = "active"
        store.subscription_renewal = new Date(
          Date.now() + (30 * 24 * 60 * 60 * 1000)
        )

        await store.save()

      }

    }


    /*
    SUBSCRIPTION CANCELLED
    */

    if(event.type === "customer.subscription.deleted"){

      const subscription = event.data.object

      const store = await Store.findOne({
        stripe_customer_id: subscription.customer
      })

      if(store){

        store.subscription_status = "cancelled"

        await store.save()

      }

    }

    res.json({ received:true })

  }catch(error){

    console.error("Stripe webhook error:", error)

    res.status(500).json({
      error:"Webhook processing failed"
    })

  }

}



 /*
--------------------------------
PAYSTACK WEBHOOK
--------------------------------
*/

async function handlePaystackWebhook(req, res){

  try{

    const event = req.body

    console.log("Paystack webhook:", event.event)

    /*
    PAYMENT SUCCESS
    */

    if(event.event === "charge.success"){

      const email = event.data.customer.email

      const store = await Store.findOne({
        email: email
      })

      if(store){

        store.subscription_status = "active"

        store.subscription_renewal = new Date(
          Date.now() + (30 * 24 * 60 * 60 * 1000)
        )

        await store.save()

      }

    }

    res.json({ received:true })

  }catch(error){

    console.error("Paystack webhook error:", error)

    res.status(500).json({
      error:"Webhook processing failed"
    })

  }

}



module.exports = {

  handleStripeWebhook,
  handlePaystackWebhook

}