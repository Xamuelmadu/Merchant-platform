const axios = require("axios")

async function sendWhatsAppMessage(phone, message){

  try{

    await axios.post(

      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,

      {
        messaging_product:"whatsapp",
        to:phone,
        type:"text",
        text:{
          body:message
        }
      },

      {
        headers:{
          Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type":"application/json"
        }
      }

    )

  }catch(error){

    console.error("WhatsApp send error:",error.message)

  }

}

module.exports = { sendWhatsAppMessage }