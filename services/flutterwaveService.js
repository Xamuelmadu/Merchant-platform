const axios = require("axios")


/*
================================
CREATE FLUTTERWAVE PAYMENT
================================

Creates a Flutterwave hosted checkout
for an order.

The internal order reference is used
as Flutterwave's tx_ref.

Flutterwave's transaction ID is also
returned when available so it can be
used later for server-side verification.
================================
*/

async function createFlutterwavePayment(
  order
) {

  if (!order) {

    throw new Error(
      "Order is required"
    )

  }


  if (!order._id) {

    throw new Error(
      "Order ID is required"
    )

  }


  if (
    order.total_price === undefined ||
    order.total_price === null
  ) {

    throw new Error(
      "Order total is required"
    )

  }


  /*
  --------------------------------
  PAYMENT REFERENCE
  --------------------------------
  */

  const reference =
    `order_${order._id}`


  /*
  --------------------------------
  REDIRECT URL
  --------------------------------
  */

  const redirectUrl =
    process.env.FLUTTERWAVE_REDIRECT_URL


  if (!redirectUrl) {

    throw new Error(
      "FLUTTERWAVE_REDIRECT_URL is not configured"
    )

  }


  /*
  --------------------------------
  CUSTOMER EMAIL
  --------------------------------
  */

  const customerEmail =
    order.customer_email ||
    (
      order.customer_phone
        ? `${order.customer_phone}@whatsapp.ai`
        : `customer_${order._id}@whatsapp.ai`
    )


  /*
  --------------------------------
  CREATE PAYMENT
  --------------------------------
  */

  try {

    const response =
      await axios.post(

        "https://api.flutterwave.com/v3/payments",

        {

          tx_ref:
            reference,

          amount:
            Number(order.total_price),

          currency:
            order.currency || "NGN",

          redirect_url:
            redirectUrl,


          customer: {

            email:
              customerEmail,

            phonenumber:
              order.customer_phone || "",

            name:
              order.customer_name || "Customer"

          },


          customizations: {

            title:
              "Guava",

            description:
              `Payment for order ${order._id}`

          }

        },

        {

          headers: {

            Authorization:
              `Bearer ${process.env.FLUTTERWAVE_SECRET}`,

            "Content-Type":
              "application/json"

          }

        }

      )


    /*
    --------------------------------
    FLUTTERWAVE RESPONSE
    --------------------------------
    */

    const data =
      response.data?.data


    const paymentLink =
      data?.link


    if (!paymentLink) {

      console.error(
        "Flutterwave response:",
        response.data
      )

      throw new Error(
        "Flutterwave did not return a payment link"
      )

    }


    /*
    --------------------------------
    TRANSACTION ID
    --------------------------------

    Flutterwave may return a transaction
    identifier in the payment creation
    response.

    Keep it separate from our internal
    order reference.
    --------------------------------
    */

    const transactionId =
      data?.id ||
      data?.transaction_id ||
      null


    /*
    --------------------------------
    RETURN PAYMENT DATA
    --------------------------------
    */

    return {

      payment_link:
        paymentLink,

      reference,

      transaction_id:
        transactionId

    }

  } catch (error) {

    console.error(
      "Flutterwave payment creation failed:",
      error.response?.data ||
      error.message
    )


    throw new Error(
      error.response?.data?.message ||
      "Unable to create Flutterwave payment"
    )

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  createFlutterwavePayment

}