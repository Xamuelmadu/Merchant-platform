const express = require("express")
const router = express.Router()

const Store = require("../models/store")

const customerConversationAuth = require(
  "../middleware/customerConversationAuth"
)

const {
  handleCustomerConversation
} = require(
  "../controllers/conversationController"
)

/*
================================
MERCHANT LOOKUP
================================
*/

router.get("/merchant/:number", async (req, res) => {
  try {
    const number = req.params.number

    const store = await Store.findOne({
      whatsapp_number: number
    })

    if (!store) {
      return res.json(null)
    }

    return res.json(store)

  } catch (error) {
    console.error("Merchant lookup error:", error)

    return res.status(500).json({
      success: false,
      error: "Merchant lookup failed"
    })
  }
})

/*
================================
CUSTOMER CONVERSATION
================================

Shopify / WooCommerce / custom
storefront chatbot endpoint.

POST /api/engine/conversation

Uses the existing customer conversation
authentication and handler.
================================
*/

router.post(
  "/conversation",
  customerConversationAuth,
  handleCustomerConversation
)

module.exports = router