const Store = require("../models/Store")
const Order = require("../models/Order")

const stripeService = require("./stripeService")
const paystackService = require("./paystackService")



async function runMonthlyBilling(){

  console.log("Running billing cycle...")

  const today = new Date()



  /*
  --------------------------------
  CHARGE STORES DUE TODAY
  --------------------------------
  */

  const stores = await Store.find({
    subscription_status:"active",
    subscription_renewal:{ $lte:today }
  })



  for(const store of stores){

    try{

      const stats = await Order.aggregate([
        { $match:{ store_id:store._id } },
        { $group:{
            _id:null,
            revenue:{ $sum:"$total_price" }
        }}
      ])


      const revenue = stats[0]?.revenue || 0

      const platformFee = revenue * store.transaction_fee


      /*
      STRIPE CHARGE
      */

      if(store.stripe_customer_id){

        await stripeService.chargeCustomer(
          store.stripe_customer_id,
          platformFee
        )

      }


      /*
      PAYSTACK CHARGE
      */

      else if(store.paystack_authorization_code){

        await paystackService.chargeAuthorization(
          store.paystack_authorization_code,
          platformFee
        )

      }


      /*
      UPDATE NEXT BILLING DATE
      */

      store.subscription_renewal = new Date(
        Date.now() + 30*24*60*60*1000
      )

      await store.save()


      console.log(`Charged store ${store._id}`)

    }

    catch(err){

      console.log("Payment failed for store:",store._id)

      store.subscription_status = "past_due"

      store.billing_grace_until = new Date(
        Date.now() + 7*24*60*60*1000
      )

      await store.save()

    }

  }



  /*
  --------------------------------
  LOCK STORES AFTER GRACE PERIOD
  --------------------------------
  */

  const overdueStores = await Store.find({
    subscription_status:"past_due",
    billing_grace_until:{ $lte:today }
  })



  for(const store of overdueStores){

    store.system_locked = true

    await store.save()

    console.log(`Store locked: ${store._id}`)

  }

}



module.exports = { runMonthlyBilling }