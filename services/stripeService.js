const Stripe = require("stripe")

const stripeSecret = process.env.STRIPE_SECRET

const stripe = stripeSecret
  ? new Stripe(stripeSecret)
  : null

async function createStripePayment(order) {

  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET to enable Stripe payments."
    )
  }

  if (!order) {
    throw new Error("Order is required")
  }

  if (!order.total_price || Number(order.total_price) <= 0) {
    throw new Error("Order total must be greater than zero")
  }

  const session = await stripe.checkout.sessions.create({

    payment_method_types: ["card"],

    line_items: [
      {
        price_data: {
          currency: String(order.currency || "USD").toLowerCase(),

          product_data: {
            name: "WhatsApp Store Order"
          },

          unit_amount: Math.round(
            Number(order.total_price) * 100
          )
        },

        quantity: 1
      }
    ],

    mode: "payment",

    success_url:
      process.env.STRIPE_SUCCESS_URL ||
      "https://yourdomain.com/payment-success",

    cancel_url:
      process.env.STRIPE_CANCEL_URL ||
      "https://yourdomain.com/payment-cancel",

    metadata: {
      order_id: String(order._id || ""),
      reference: String(order.payment_reference || ""),
      store_id: String(order.store_id || "")
    }

  })

  return {
    payment_link: session.url,
    reference: session.id
  }
}

module.exports = {
  createStripePayment
}