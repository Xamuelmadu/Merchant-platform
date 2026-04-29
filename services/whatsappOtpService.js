const axios = require("axios")

async function sendWhatsAppOTP(phone, otp){

  try{

    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "otp_code",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: otp }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    )

  }catch(error){

    console.error("WhatsApp OTP error:", error.response?.data || error.message)

    throw new Error("OTP delivery failed")
  }

}

module.exports = { sendWhatsAppOTP }