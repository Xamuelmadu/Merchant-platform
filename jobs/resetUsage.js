const Store = require("../models/store")
const cron = require("node-cron")

async function resetUsage() {
  try {
    await Store.updateMany(
      {},
      { orders_used: 0 }
    )

    console.log("Monthly order usage reset")

  } catch (error) {
    console.error("Usage reset error:", error.message)
  }
}

/*
--------------------------------
RUN MONTHLY (RECOMMENDED)
--------------------------------
Every 1st day of the month at 00:00
*/

cron.schedule("0 0 1 * *", async () => {
  await resetUsage()
})

module.exports = resetUsage