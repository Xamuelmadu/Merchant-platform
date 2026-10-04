const Order = require("../models/order")

const {
  verifyPaystack,
  verifyFlutterwave
} = require("../services/paymentVerificationService")


/*
================================
PAYSTACK WEBHOOK
================================

Receives Paystack webhook events.

The webhook payload is NOT trusted
for payment confirmation.

We verify the transaction directly
with Paystack before updating the
order.
================================
*/

async function paystackWebhook(req, res) {

  try {

    const event =
      req.body


    /*
    --------------------------------
    ONLY PROCESS SUCCESSFUL PAYMENTS
    --------------------------------
    */

    if (
      event?.event !==
      "charge.success"
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    PAYMENT REFERENCE
    --------------------------------
    */

    const reference =
      event?.data?.reference


    if (!reference) {

      console.error(
        "Paystack webhook missing payment reference"
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY WITH PAYSTACK
    --------------------------------
    */

    const verification =
      await verifyPaystack(
        reference
      )


    const transaction =
      verification?.data


    if (
      !transaction ||
      transaction.status !==
        "success"
    ) {

      console.error(
        "Paystack transaction verification failed:",
        reference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    FIND ORDER
    --------------------------------
    */

    const order =
      await Order.findOne({

        payment_reference:
          reference

      })


    if (!order) {

      console.error(
        "Paystack order not found:",
        reference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    IDEMPOTENCY
    --------------------------------

    If the webhook is delivered more
    than once, do not process the
    payment repeatedly.
    --------------------------------
    */

    if (
      order.payment_status ===
      "paid"
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY AMOUNT
    --------------------------------

    Paystack amounts are returned
    in the smallest currency unit.

    Example:

    NGN 5,000
    =
    500000
    --------------------------------
    */

    const expectedAmount =
      Math.round(
        Number(
          order.total_price
        ) * 100
      )


    const paidAmount =
      Number(
        transaction.amount
      )


    if (
      paidAmount !==
      expectedAmount
    ) {

      console.error(
        "Paystack payment amount mismatch:",
        {
          order_id:
            order._id,

          expected:
            expectedAmount,

          received:
            paidAmount
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY CURRENCY
    --------------------------------
    */

    const expectedCurrency =
      String(
        order.currency ||
        "NGN"
      )
        .trim()
        .toUpperCase()


    const paidCurrency =
      String(
        transaction.currency ||
        ""
      )
        .trim()
        .toUpperCase()


    if (
      paidCurrency &&
      paidCurrency !==
        expectedCurrency
    ) {

      console.error(
        "Paystack payment currency mismatch:",
        {
          order_id:
            order._id,

          expected:
            expectedCurrency,

          received:
            paidCurrency
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    UPDATE ORDER
    --------------------------------
    */

    order.payment_status =
      "paid"

    order.order_status =
      "paid"

    order.payment_gateway =
      "paystack"

    order.payment_transaction_id =
      String(
        transaction.id ||
        ""
      )


    await order.save()


    console.log(
      "✅ Paystack payment confirmed:",
      order._id
    )


    return res.sendStatus(200)


  } catch (error) {

    console.error(
      "❌ Paystack webhook error:",
      error.response?.data ||
      error.message ||
      error
    )

    return res.sendStatus(500)

  }

}


/*
================================
FLUTTERWAVE WEBHOOK
================================

Receives Flutterwave webhook events.

The webhook payload is NOT trusted
for payment confirmation.

The transaction is verified directly
against Flutterwave before the order
is marked as paid.
================================
*/

async function flutterwaveWebhook(
  req,
  res
) {

  try {

    const event =
      req.body


    /*
    --------------------------------
    TRANSACTION DATA
    --------------------------------
    */

    const transactionId =
      event?.data?.id


    const webhookReference =
      event?.data?.tx_ref


    if (
      !transactionId ||
      !webhookReference
    ) {

      console.error(
        "Flutterwave webhook missing transaction ID or reference"
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY TRANSACTION
    --------------------------------
    */

    const verification =
      await verifyFlutterwave(
        transactionId
      )


    const transaction =
      verification?.data


    /*
    --------------------------------
    VERIFY STATUS
    --------------------------------
    */

    if (
      !transaction ||
      transaction.status !==
        "successful"
    ) {

      console.error(
        "Flutterwave transaction verification failed:",
        webhookReference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY PAYMENT REFERENCE
    --------------------------------
    */

    const verifiedReference =
      transaction.tx_ref


    if (
      String(
        verifiedReference
      ) !==
      String(
        webhookReference
      )
    ) {

      console.error(
        "Flutterwave payment reference mismatch:",
        {
          webhook:
            webhookReference,

          verified:
            verifiedReference
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    FIND ORDER
    --------------------------------
    */

    const order =
      await Order.findOne({

        payment_reference:
          webhookReference

      })


    if (!order) {

      console.error(
        "Flutterwave order not found:",
        webhookReference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    IDEMPOTENCY
    --------------------------------
    */

    if (
      order.payment_status ===
      "paid"
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY AMOUNT
    --------------------------------
    */

    const expectedAmount =
      Number(
        order.total_price
      )


    const paidAmount =
      Number(
        transaction.amount
      )


    if (
      paidAmount !==
      expectedAmount
    ) {

      console.error(
        "Flutterwave payment amount mismatch:",
        {
          order_id:
            order._id,

          expected:
            expectedAmount,

          received:
            paidAmount
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY CURRENCY
    --------------------------------
    */

    const expectedCurrency =
      String(
        order.currency ||
        "NGN"
      )
        .trim()
        .toUpperCase()


    const paidCurrency =
      String(
        transaction.currency ||
        ""
      )
        .trim()
        .toUpperCase()


    if (
      paidCurrency !==
      expectedCurrency
    ) {

      console.error(
        "Flutterwave payment currency mismatch:",
        {
          order_id:
            order._id,

          expected:
            expectedCurrency,

          received:
            paidCurrency
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    UPDATE ORDER
    --------------------------------
    */

    order.payment_status =
      "paid"

    order.order_status =
      "paid"

    order.payment_gateway =
      "flutterwave"

    order.payment_transaction_id =
      String(
        transaction.id ||
        transactionId
      )


    await order.save()


    console.log(
      "✅ Flutterwave payment confirmed:",
      order._id
    )


    return res.sendStatus(200)


  } catch (error) {

    console.error(
      "❌ Flutterwave webhook error:",
      error.response?.data ||
      error.message ||
      error
    )

    return res.sendStatus(500)

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  paystackWebhook,

  flutterwaveWebhook

}