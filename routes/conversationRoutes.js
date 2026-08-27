const express =
  require("express")

const auth =
  require("../middleware/auth")

const customerConversationAuth =
  require(
    "../middleware/customerConversationAuth"
  )

const {
  handleConversation,
  handleCustomerConversation
} =
  require(
    "../controllers/conversationController"
  )


const router =
  express.Router()


/*
--------------------------------
MERCHANT-AUTHENTICATED
--------------------------------
*/

router.post(
  "/",
  auth,
  handleConversation
)


/*
--------------------------------
CUSTOMER-FACING
--------------------------------

Used by Shopify/WooCommerce/
custom storefront widgets.
--------------------------------
*/

router.post(
  "/customer",
  customerConversationAuth,
  handleCustomerConversation
)


module.exports =
  router