const Store = require("../models/Store")

async function resetMonthlyUsage(){

  console.log("Resetting usage counters...")

  await Store.updateMany(
    {},
    {
      $set:{
        orders_used:0
      }
    }
  )

}

module.exports = { resetMonthlyUsage }