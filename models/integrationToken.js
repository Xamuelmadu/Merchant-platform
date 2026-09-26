const mongoose = require("mongoose")


/*
================================
INTEGRATION TOKEN
================================

Temporary installation tokens used
to securely connect external commerce
platforms to a merchant account.

The raw token is never stored.

Only the SHA-256 hash is stored.
================================
*/

const IntegrationTokenSchema =
  new mongoose.Schema({

    /*
    --------------------------------
    MERCHANT
    --------------------------------
    */

    merchant_id: {
      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        "User",

      required:
        true,

      index:
        true
    },


    /*
    --------------------------------
    INTEGRATION TYPE
    --------------------------------
    */

    type: {
      type:
        String,

      enum: [
        "woocommerce"
      ],

      required:
        true,

      index:
        true
    },


    /*
    --------------------------------
    TOKEN HASH
    --------------------------------
    */

    token_hash: {
      type:
        String,

      required:
        true,

      unique:
        true,

      index:
        true
    },


    /*
    --------------------------------
    EXPIRATION
    --------------------------------
    */

    expires_at: {
      type:
        Date,

      required:
        true,

      index:
        true
    },


    /*
    --------------------------------
    TOKEN STATUS
    --------------------------------
    */

    used: {
      type:
        Boolean,

      default:
        false
    },


    used_at: {
      type:
        Date
    }

  }, {

    timestamps:
      true

  })


/*
--------------------------------
TTL INDEX
--------------------------------

MongoDB automatically removes
expired integration tokens.
--------------------------------
*/

IntegrationTokenSchema.index(
  {
    expires_at: 1
  },
  {
    expireAfterSeconds: 0
  }
)


module.exports =
  mongoose.model(
    "IntegrationToken",
    IntegrationTokenSchema
  )