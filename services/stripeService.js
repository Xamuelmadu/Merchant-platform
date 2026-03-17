const Stripe = require("stripe")

const stripe = new Stripe(process.env.STRIPE_SECRET)

async function createStripePayment(order){

  const session = await stripe.checkout.sessions.create({

    payment_method_types:["card"],

    line_items:[
      {
        price_data:{
          currency:"usd",
          product_data:{
            name:"WhatsApp Store Order"
          },
          unit_amount:order.total_price * 100
        },
        quantity:1
      }
    ],

    mode:"payment",

    success_url:"https://yourdomain.com/payment-success",
    cancel_url:"https://yourdomain.com/payment-cancel",

    metadata:{
      order_id:order._id
    }

  })

  return {
    payment_link:session.url,
    reference:session.id
  }

}

module.exports = { createStripePayment }