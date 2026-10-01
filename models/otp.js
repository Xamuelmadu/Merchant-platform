const mongoose = require("mongoose")

const OtpSchema = new mongoose.Schema({

  /*
  --------------------------------
  EMAIL
  --------------------------------
  */

  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },


  /*
  --------------------------------
  OTP
  --------------------------------
  */

  otp: {
    type: String,
    required: true
  },


  /*
  --------------------------------
  PURPOSE
  --------------------------------

  signup
  → First-time account creation

  signin
  → Existing user login

  email_verification
  → Verify/change an email address
  --------------------------------
  */

  purpose: {
    type: String,
    enum: [
      "signup",
      "signin",
      "email_verification"
    ],
    required: true,
    index: true
  },


  /*
  --------------------------------
  EXPIRATION
  --------------------------------
  */

  expires_at: {
    type: Date,
    required: true,
    index: true
  },


  /*
  --------------------------------
  VERIFICATION ATTEMPTS
  --------------------------------

  Prevent unlimited OTP guessing.
  --------------------------------
  */

  attempts: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  CREATED / VERIFIED STATE
  --------------------------------
  */

  verified: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
})


/*
--------------------------------
INDEXES
--------------------------------
*/

/*
Only one active OTP record should
exist for an email + purpose.

The auth controller will delete the
previous OTP before creating a new one.
*/

OtpSchema.index({
  email: 1,
  purpose: 1
})


/*
--------------------------------
AUTOMATIC EXPIRATION
--------------------------------

MongoDB removes expired OTP records
automatically.

The TTL index uses expires_at itself.
--------------------------------
*/

OtpSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
)


module.exports =
  mongoose.model(
    "Otp",
    OtpSchema
  )