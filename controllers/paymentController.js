const Order = require("../models/order")

const {
  verifyPaystack,
  verifyFlutterwave
} = require("../services/paymentVerificationService")


/*
================================
HELPERS
================================
*/

function markOrderAsPaid(order) {

  order.payment_status = "paid"

  order.order_status = "paid"

}


/*
================================
PAYSTACK WEBHOOK
================================
*/

async function paystackWebhook(req, res) {

  try {

    const event =
      req.body


    /*
    --------------------------------
    ONLY PROCESS SUCCESSFUL CHARGES
    --------------------------------
    */

    if (
      event?.event !==
      "charge.success"
    ) {

      return res.sendStatus(200)

    }


    const reference =
      event?.data?.reference


    if (!reference) {

      console.error(
        "Paystack webhook missing reference"
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
        "Paystack webhook order not found:",
        reference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    IDEMPOTENCY
    --------------------------------

    Do not process an already-paid
    order again.
    */

    if (
      order.payment_status ===
      "paid"
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY PAYMENT
    --------------------------------

    Never trust the webhook payload
    alone. Verify the transaction
    directly with Paystack.
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
        "Paystack payment verification failed:",
        reference
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    AMOUNT VALIDATION
    --------------------------------
    */

    const paidAmount =
      Number(
        transaction.amount || 0
      ) / 100


    const expectedAmount =
      Number(
        order.total_price || 0
      )


    if (
      paidAmount <
      expectedAmount
    ) {

      console.error(
        "Paystack payment amount mismatch:",
        {
          reference,
          paidAmount,
          expectedAmount
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    MARK ORDER PAID
    --------------------------------
    */

    markOrderAsPaid(
      order
    )


    order.payment_gateway =
      "paystack"


    order.payment_reference =
      reference


    await order.save()


    console.log(
      "Paystack payment confirmed:",
      order._id
    )


    return res.sendStatus(200)

  } catch (error) {

    console.error(
      "Paystack webhook error:",
      error.response?.data ||
      error.message
    )


    return res.sendStatus(500)

  }

}


/*
================================
FLUTTERWAVE WEBHOOK
================================

Flutterwave sends a webhook after
a transaction changes state.

The webhook is NOT trusted by itself.

We use the Flutterwave transaction ID
to perform server-side verification.
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
    LOG WEBHOOK EVENT
    --------------------------------
    */

    console.log(
      "Flutterwave webhook received:",
      JSON.stringify(
        event
      )
    )


    /*
    --------------------------------
    EXTRACT TRANSACTION DATA
    --------------------------------
    */

    const transactionId =
      event?.data?.id


    const txRef =
      event?.data?.tx_ref


    const status =
      event?.data?.status


    /*
    --------------------------------
    IGNORE INVALID WEBHOOKS
    --------------------------------
    */

    if (
      !transactionId &&
      !txRef
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    ONLY PROCESS SUCCESS EVENTS
    --------------------------------
    */

    if (
      status &&
      status !== "successful"
    ) {

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    FIND ORDER
    --------------------------------

    tx_ref is our internal reference:

    order_<mongodb_id>
    */

    let order = null


    if (txRef) {

      order =
        await Order.findOne({

          payment_reference:
            txRef

        })

    }


    /*
    --------------------------------
    FALLBACK TO TRANSACTION ID
    --------------------------------
    */

    if (
      !order &&
      transactionId
    ) {

      order =
        await Order.findOne({

          payment_transaction_id:
            String(
              transactionId
            )

        })

    }


    if (!order) {

      console.error(
        "Flutterwave webhook order not found:",
        {
          txRef,
          transactionId
        }
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
    VERIFY DIRECTLY WITH FLUTTERWAVE
    --------------------------------
    */

    if (!transactionId) {

      console.error(
        "Flutterwave webhook has no transaction ID:",
        txRef
      )

      return res.sendStatus(200)

    }


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
        "Flutterwave payment verification failed:",
        {
          transactionId,
          txRef,
          status:
            transaction?.status
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY TX REF
    --------------------------------
    */

    if (
      transaction.tx_ref &&
      transaction.tx_ref !==
        order.payment_reference
    ) {

      console.error(
        "Flutterwave tx_ref mismatch:",
        {
          transactionTxRef:
            transaction.tx_ref,

          orderReference:
            order.payment_reference
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY CURRENCY
    --------------------------------
    */

    const transactionCurrency =
      String(
        transaction.currency ||
        ""
      )
        .trim()
        .toUpperCase()


    const orderCurrency =
      String(
        order.currency ||
        ""
      )
        .trim()
        .toUpperCase()


    if (
      transactionCurrency &&
      orderCurrency &&
      transactionCurrency !==
        orderCurrency
    ) {

      console.error(
        "Flutterwave currency mismatch:",
        {
          transactionCurrency,
          orderCurrency
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    VERIFY AMOUNT
    --------------------------------
    */

    const paidAmount =
      Number(
        transaction.amount || 0
      )


    const expectedAmount =
      Number(
        order.total_price || 0
      )


    if (
      paidAmount <
      expectedAmount
    ) {

      console.error(
        "Flutterwave payment amount mismatch:",
        {
          transactionId,
          paidAmount,
          expectedAmount
        }
      )

      return res.sendStatus(200)

    }


    /*
    --------------------------------
    SAVE TRANSACTION ID
    --------------------------------
    */

    order.payment_transaction_id =
      String(
        transaction.id ||
        transactionId
      )


    order.payment_reference =
      transaction.tx_ref ||
      order.payment_reference


    order.payment_gateway =
      "flutterwave"


    /*
    --------------------------------
    MARK ORDER PAID
    --------------------------------
    */

    markOrderAsPaid(
      order
    )


    await order.save()


    console.log(
      "Flutterwave payment confirmed:",
      order._id
    )


    return res.sendStatus(200)

  } catch (error) {

    console.error(
      "Flutterwave webhook error:",
      error.response?.data ||
      error.message
    )


    return res.sendStatus(500)

  }

}


/*
================================
MANUAL PAYMENT VERIFICATION
================================

Useful for the frontend redirect
after Flutterwave checkout.

The customer returns to the
dashboard with a transaction ID.

The server verifies directly with
Flutterwave before changing the
order status.
================================
*/

async function verifyFlutterwavePayment(
  req,
  res
) {

  try {

    const {
      transaction_id,
      tx_ref
    } = req.query


    if (
      !transaction_id &&
      !tx_ref
    ) {

      return res.status(400).json({

        success: false,

        error:
          "transaction_id or tx_ref is required"

      })

    }


    /*
    --------------------------------
    FIND ORDER
    --------------------------------
    */

    let order = null


    if (tx_ref) {

      order =
        await Order.findOne({

          payment_reference:
            tx_ref

        })

    }


    if (
      !order &&
      transaction_id
    ) {

      order =
        await Order.findOne({

          payment_transaction_id:
            String(
              transaction_id
            )

        })

    }


    if (!order) {

      return res.status(404).json({

        success: false,

        error:
          "Order not found"

      })

    }


    /*
    --------------------------------
    VERIFY TRANSACTION
    --------------------------------
    */

    const verification =
      await verifyFlutterwave(
        transaction_id
      )


    const transaction =
      verification?.data


    if (
      !transaction ||
      transaction.status !==
        "successful"
    ) {

      return res.status(400).json({

        success: false,

        payment_status:
          "failed"

      })

    }


    /*
    --------------------------------
    VERIFY REFERENCE
    --------------------------------
    */

    if (
      transaction.tx_ref &&
      transaction.tx_ref !==
        order.payment_reference
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Payment reference mismatch"

      })

    }


    /*
    --------------------------------
    VERIFY AMOUNT
    --------------------------------
    */

    const paidAmount =
      Number(
        transaction.amount || 0
      )


    const expectedAmount =
      Number(
        order.total_price || 0
      )


    if (
      paidAmount <
      expectedAmount
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Payment amount mismatch"

      })

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
        transaction_id
      )


    await order.save()


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.json({

      success: true,

      message:
        "Payment verified successfully",

      order: {

        id:
          order._id,

        payment_status:
          order.payment_status,

        order_status:
          order.order_status,

        payment_gateway:
          order.payment_gateway,

        payment_reference:
          order.payment_reference,

        payment_transaction_id:
          order.payment_transaction_id

      }

    })

  } catch (error) {

    console.error(
      "Flutterwave payment verification error:",
      error.response?.data ||
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Payment verification failed"

    })

  }

}


/*
================================
EXPORTS
================================
*/

module.exports = {

  paystackWebhook,

  flutterwaveWebhook,

  verifyFlutterwavePayment

}