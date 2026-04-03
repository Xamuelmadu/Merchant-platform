const Store = require("../models/store")

async function checkSubscriptions(){

  try{

    const now = new Date()

    const expiredStores = await Store.find({
      subscription_status: "active",
      subscription_renewal: { $lt: now }
    })

    for(const store of expiredStores){

      store.plan = "free"
      store.subscription_status = "expired"

      await store.save()

      console.log("⬇️ Downgraded store:", store._id)

    }

  }catch(error){
    console.error("Subscription cron error:", error)
  }

}

module.exports = { checkSubscriptions }