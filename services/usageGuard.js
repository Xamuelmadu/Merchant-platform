const Store = require("../models/Store")

async function checkUsageLimit(merchantId){

  const store = await Store.findOne({
    merchant_id:merchantId
  })

  if(!store){
    throw new Error("Store not found")
  }

  /*
  PLAN LIMIT CHECK
  */

  if(store.monthly_order_limit > 0){

    if(store.orders_used >= store.monthly_order_limit){

      throw new Error(
        "Monthly order limit reached. Please upgrade your plan."
      )

    }

  }

  return store

}

module.exports = { checkUsageLimit }