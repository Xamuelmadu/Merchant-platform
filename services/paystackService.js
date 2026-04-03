const axios = require("axios")

async function createPaystackPayment(order){

  try{

    const response = await axios.post(

      "https://api.paystack.co/transaction/initialize",

      {
        email:`${order.customer_phone}@whatsapp.ai`,
        amount:order.total_price * 100,

        metadata: {
  store_id: store._id.toString(),
  plan: plan
}
      },

      {
        headers:{
          Authorization:`Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type":"application/json"
        }
      }

    )


    return {

      payment_link:response.data.data.authorization_url,

      reference:response.data.data.reference

    }


  }catch(error){

    console.error(
      "Paystack error:",
      error.response?.data || error.message
    )

    throw new Error("Payment initialization failed")

  }

}

module.exports = {

  createPaystackPayment

}
