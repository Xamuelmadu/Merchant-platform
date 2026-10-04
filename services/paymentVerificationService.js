const axios = require("axios")


/*
================================
VERIFY PAYSTACK PAYMENT
================================
*/

async function verifyPaystack(reference) {

  if (!reference) {
    throw new Error(
      "Paystack payment reference is required"
    )
  }


  const res = await axios.get(

    `https://api.paystack.co/transaction/verify/${reference}`,

    {
      headers: {
        Authorization:
          `Bearer ${process.env.PAYSTACK_SECRET}`
      }
    }

  )


  return res.data

}


/*
================================
VERIFY FLUTTERWAVE PAYMENT
================================
*/

async function verifyFlutterwave(transactionId) {

  if (!transactionId) {
    throw new Error(
      "Flutterwave transaction ID is required"
    )
  }


  const res = await axios.get(

    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,

    {
      headers: {
        Authorization:
          `Bearer ${process.env.FLUTTERWAVE_SECRET}`,

        "Content-Type":
          "application/json"
      }
    }

  )


  return res.data

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  verifyPaystack,

  verifyFlutterwave

}