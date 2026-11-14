const express = require("express")
const router = express.Router()
const { subscribe, unsubscribe } = require("../controllers/marketingController")

router.post("/subscribe", subscribe)
router.get("/unsubscribe", unsubscribe)
router.post("/unsubscribe", unsubscribe)

module.exports = router
