const { createPaystackPayment } = require("./paystackService")
const { createFlutterwavePayment } = require("./flutterwaveService")
const { createStripePayment } = require("./stripeService")

async function processPayment(gateway, order){

  switch(gateway){

    case "paystack":
      return await createPaystackPayment(order)

    case "flutterwave":
      return await createFlutterwavePayment(order)

    case "stripe":
      return await createStripePayment(order)

    default:
      throw new Error("Unsupported payment gateway")

  }

}

module.exports = { processPayment }