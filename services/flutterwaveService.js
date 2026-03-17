const axios = require("axios")

async function createFlutterwavePayment(order){

  const response = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    {
      tx_ref: `order_${order._id}`,
      amount: order.total_price,
      currency: "NGN",
      redirect_url: "https://yourdomain.com/payment-success",

      customer:{
        email:`${order.customer_phone}@whatsapp.ai`,
        phonenumber:order.customer_phone,
        name:order.customer_name
      },

      customizations:{
        title:"WhatsApp Store Payment",
        description:`Order ${order._id}`
      }

    },
    {
      headers:{
        Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET}`,
        "Content-Type":"application/json"
      }
    }
  )

  return {
    payment_link:response.data.data.link,
    reference:`order_${order._id}`
  }

}

module.exports = { createFlutterwavePayment }