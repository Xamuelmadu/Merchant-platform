const axios = require("axios")


/*
--------------------------------
AI ENGINE SERVICE
--------------------------------

The merchant platform is the trusted
gateway between commerce channels and
the AI Commerce Engine.

The engine URL is configured through:

AI_ENGINE_URL

Example:

AI_ENGINE_URL=https://your-engine.up.railway.app
--------------------------------
*/


async function sendConversationToEngine({

  store,

  channel,

  customer,

  message

}) {

  if (!store) {
    throw new Error(
      "Store is required"
    )
  }


  if (!channel) {
    throw new Error(
      "Channel is required"
    )
  }


  if (!customer?.external_id) {
    throw new Error(
      "Customer external_id is required"
    )
  }


  if (!message?.trim()) {
    throw new Error(
      "Message is required"
    )
  }


  const engineUrl =
    process.env.AI_ENGINE_URL


  if (!engineUrl) {

    throw new Error(
      "AI_ENGINE_URL is not configured"
    )

  }


  const response =
    await axios.post(

      `${engineUrl}/conversation`,

      {

        store,

        channel,

        customer,

        message:
          message.trim()

      },

      {

        timeout: 30000,

        headers: {

          "Content-Type":
            "application/json",

          ...(process.env.AI_ENGINE_SECRET
            ? {
                "x-ai-engine-secret":
                  process.env.AI_ENGINE_SECRET
              }
            : {})

        }

      }

    )


  return response.data

}


module.exports = {

  sendConversationToEngine

}