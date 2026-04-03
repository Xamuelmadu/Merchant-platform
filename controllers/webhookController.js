const crypto = require("crypto")
const Store = require("../models/store")



/*
--------------------------------
HELPER: ADD 1 YEAR
--------------------------------
*/
function addOneYear(){
  return new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
}



/*
--------------------------------
STRIPE WEBHOOK (SECURE)
--------------------------------
*/
async function handleStripeWebhook(req, res){

  try{

    const event = req.body

    console.log("Stripe webhook:", event.type)


    /*
    PAYMENT SUCCESS
    */
    if(event.type === "checkout.session.completed"){

      const session = event.data.object

      const customerId = session.customer

      const plan = session.metadata?.plan || "starter"

      const store = await Store.findOne({
        stripe_customer_id: customerId
      })

      if(!store){
        console.log("Store not found for Stripe customer:", customerId)
        return res.json({ received:true })
      }

      /*
      ACTIVATE PLAN
      */
      store.plan = plan
      store.subscription_status = "active"
      store.subscription_renewal = addOneYear()

      await store.save()

      console.log("✅ Stripe subscription activated:", plan)

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

        console.log("❌ Stripe subscription cancelled")

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
PAYSTACK WEBHOOK (SECURE)
--------------------------------
*/
async function handlePaystackWebhook(req, res){

  try{

    /*
    --------------------------------
    VERIFY SIGNATURE (VERY IMPORTANT)
    --------------------------------
    */
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex")

    if(hash !== req.headers["x-paystack-signature"]){
      console.log("❌ Invalid Paystack signature")
      return res.status(401).send("Invalid signature")
    }


    const event = req.body

    console.log("Paystack webhook:", event.event)


    /*
    PAYMENT SUCCESS
    */
    if(event.event === "charge.success"){

      const data = event.data

      /*
      IMPORTANT: USE METADATA
      */
      const storeId = data.metadata?.store_id
      const plan = data.metadata?.plan || "starter"

      if(!storeId){
        console.log("❌ No store_id in metadata")
        return res.json({ received:true })
      }

      const store = await Store.findById(storeId)

      if(!store){
        console.log("❌ Store not found:", storeId)
        return res.json({ received:true })
      }


      /*
      ACTIVATE PLAN
      */
      store.plan = plan
      store.subscription_status = "active"
      store.subscription_renewal = addOneYear()

      await store.save()

      console.log("✅ Paystack subscription activated:", plan)

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