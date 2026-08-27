const Store =
  require("../models/store")

const {
  sendConversationToEngine
} =
  require("../services/aiEngineService")


/*
================================
CUSTOMER CONVERSATION
================================

Authenticated/internal conversation
endpoint.

Used by:
- Shopify
- WooCommerce
- Custom channels
- Merchant platform
================================
*/

async function handleConversation(
  req,
  res
) {

  try {

    const {

      store_id,

      channel,

      customer,

      message

    } = req.body


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!store_id) {

      return res.status(400).json({

        success: false,

        error:
          "store_id is required"

      })

    }


    if (!channel) {

      return res.status(400).json({

        success: false,

        error:
          "channel is required"

      })

    }


    if (
      ![
        "shopify",
        "woocommerce",
        "custom"
      ].includes(channel)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Unsupported channel"

      })

    }


    if (
      !customer?.external_id
    ) {

      return res.status(400).json({

        success: false,

        error:
          "customer.external_id is required"

      })

    }


    if (
      !message ||
      !message.trim()
    ) {

      return res.status(400).json({

        success: false,

        error:
          "message is required"

      })

    }


    /*
    --------------------------------
    LOAD STORE
    --------------------------------
    */

    const store =
      await Store.findOne({

        _id:
          store_id,

        merchant_id:
          req.user.id

      })


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

      })

    }


    /*
    --------------------------------
    CHANNEL VALIDATION
    --------------------------------
    */

    if (
      channel === "shopify" &&
      (
        store.platform !== "shopify" ||
        !store.platform_connected ||
        !store.shopify?.connected
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Shopify store is not connected"

      })

    }


    if (
      channel === "woocommerce" &&
      (
        store.platform !== "woocommerce" ||
        !store.platform_connected ||
        !store.woocommerce?.connected
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "WooCommerce store is not connected"

      })

    }


    /*
    --------------------------------
    SEND TO ENGINE
    --------------------------------
    */

    const result =
      await sendConversationToEngine({

        store:
          store.toObject(),

        channel,

        customer: {

          external_id:
            String(
              customer.external_id
            ),

          name:
            customer.name ||
            null,

          email:
            customer.email ||
            null,

          phone:
            customer.phone ||
            null

        },

        message:
          message.trim()

      })


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.status(200).json({

      success:
        true,

      ...result

    })


  } catch (error) {

    console.error(
      "Conversation controller error:",
      error.message
    )


    /*
    --------------------------------
    ENGINE ERROR
    --------------------------------
    */

    const status =
      error.response?.status


    if (status) {

      return res.status(status).json({

        success: false,

        error:
          error.response?.data?.error ||
          "AI engine request failed"

      })

    }


    /*
    --------------------------------
    GENERAL ERROR
    --------------------------------
    */

    return res.status(500).json({

      success: false,

      error:
        "Unable to process conversation"

    })

  }

}


/*
================================
CUSTOMER CONVERSATION
================================

Used by the storefront/App Proxy
where the store has already been
resolved into req.conversationContext.

This does NOT require req.user.
================================
*/

async function handleCustomerConversation(
  req,
  res
) {

  try {

    const {

      customer,

      message

    } = req.body


    /*
    --------------------------------
    CONVERSATION CONTEXT
    --------------------------------
    */

    const {

      storeId,

      channel

    } =
      req.conversationContext || {}


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!storeId) {

      return res.status(400).json({

        success: false,

        error:
          "Conversation store context is missing"

      })

    }


    if (!channel) {

      return res.status(400).json({

        success: false,

        error:
          "Conversation channel is missing"

      })

    }


    if (
      ![
        "shopify",
        "woocommerce",
        "custom"
      ].includes(channel)
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Unsupported conversation channel"

      })

    }


    if (
      !customer?.external_id
    ) {

      return res.status(400).json({

        success: false,

        error:
          "customer.external_id is required"

      })

    }


    if (
      !message ||
      !message.trim()
    ) {

      return res.status(400).json({

        success: false,

        error:
          "message is required"

      })

    }


    /*
    --------------------------------
    LOAD CONNECTED STORE
    --------------------------------
    */

    const store =
      await Store.findOne({

        _id:
          storeId,

        platform:
          channel,

        platform_connected:
          true

      })


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Connected store not found"

      })

    }


    /*
    --------------------------------
    CHANNEL-SPECIFIC CONNECTION
    --------------------------------
    */

    if (
      channel === "shopify" &&
      !store.shopify?.connected
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Shopify store is not connected"

      })

    }


    if (
      channel === "woocommerce" &&
      !store.woocommerce?.connected
    ) {

      return res.status(400).json({

        success: false,

        error:
          "WooCommerce store is not connected"

      })

    }


    /*
    --------------------------------
    SEND TO ENGINE
    --------------------------------
    */

    const result =
      await sendConversationToEngine({

        store:
          store.toObject(),

        channel,

        customer: {

          external_id:
            String(
              customer.external_id
            ),

          name:
            customer.name ||
            null,

          email:
            customer.email ||
            null,

          phone:
            customer.phone ||
            null

        },

        message:
          message.trim()

      })


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.status(200).json({

      success:
        true,

      ...result

    })


  } catch (error) {

    console.error(
      "Customer conversation error:",
      error.message
    )


    /*
    --------------------------------
    ENGINE ERROR
    --------------------------------
    */

    const status =
      error.response?.status


    if (status) {

      return res.status(status).json({

        success: false,

        error:
          error.response?.data?.error ||
          "AI engine request failed"

      })

    }


    /*
    --------------------------------
    GENERAL ERROR
    --------------------------------
    */

    return res.status(500).json({

      success: false,

      error:
        "Unable to process conversation"

    })

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  handleConversation,

  handleCustomerConversation

}