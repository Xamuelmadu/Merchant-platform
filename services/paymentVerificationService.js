const axios = require("axios")

async function verifyPaystack(reference){

  const res = await axios.get(

    `https://api.paystack.co/transaction/verify/${reference}`,

    {
      headers:{
        Authorization:`Bearer ${process.env.PAYSTACK_SECRET}`
      }
    }

  )

  return res.data

}

module.exports = { verifyPaystack }