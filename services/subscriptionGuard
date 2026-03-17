const Store = require("../models/Store")

async function enforceSubscription(merchantId){

  const store = await Store.findOne({
    merchant_id:merchantId
  })

  if(!store){
    throw new Error("Store not found")
  }

  if(store.system_locked){
    throw new Error("Subscription expired")
  }

  return store

}

module.exports = { enforceSubscription }