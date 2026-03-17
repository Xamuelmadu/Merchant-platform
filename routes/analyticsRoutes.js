const express = require("express")
const router = express.Router()

const auth = require("../middleware/auth")
const loadStore = require("../middleware/loadStore")

const { getFinancialSummary } = require("../controllers/analyticsController")

router.get(
  "/financial-summary",
  auth,
  loadStore,
  getFinancialSummary
)

module.exports = router