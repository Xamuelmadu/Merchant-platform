const cron = require("node-cron")
const { processDueMarketingEmails } = require("../services/marketingEmailService")

function startMarketingEmailCron() {
  // Every 5 minutes; due subscribers are processed in bounded batches.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await processDueMarketingEmails({ batchSize: 25 })
      if (result.scanned) console.log("[Marketing] email batch:", result)
    } catch (error) {
      console.error("[Marketing] cron failed:", error.message)
    }
  })
}

module.exports = { startMarketingEmailCron }
