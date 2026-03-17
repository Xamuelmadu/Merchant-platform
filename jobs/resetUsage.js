const Store = require("../models/Store")

async function resetUsage(){

  await Store.updateMany(
    {},
    { orders_used:0 }
  )

  console.log("Monthly order usage reset")

}

const cron = require("node-cron")

cron.schedule("0 0 1 * *", async()=>{

  await resetUsage()

})

module.exports = resetUsage