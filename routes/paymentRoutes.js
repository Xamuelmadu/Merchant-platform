const express = require("express")

const router =
  express.Router()

const paymentController =
  require("../controllers/paymentController")



/*
================================
FLUTTERWAVE PAYMENT VERIFICATION
================================
*/

router.get(
  "/flutterwave/verify",
  paymentController.verifyFlutterwavePayment
)



module.exports = router