const mongoose = require("mongoose")

const CustomerSchema = new mongoose.Schema({

  /*
  --------------------------------
  STORE RELATION
  --------------------------------
  */

  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
    index: true
  },


  /*
  --------------------------------
  CUSTOMER INFO
  --------------------------------
  */

  name: {
    type: String,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },


  /*
  --------------------------------
  WHATSAPP INFO
  --------------------------------
  */

  whatsapp_id: {
    type: String,
    index: true
  },

  last_message_at: {
    type: Date
  },


  /*
  --------------------------------
  CUSTOMER METADATA
  --------------------------------
  */

  first_seen: {
    type: Date,
    default: Date.now
  },

  last_seen: {
    type: Date,
    default: Date.now
  },

  total_orders: {
    type: Number,
    default: 0
  },

  total_spent: {
    type: Number,
    default: 0
  },


  /*
  --------------------------------
  CUSTOMER TAGGING (future CRM)
  --------------------------------
  */

  tags: {
    type: [String],
    default: []
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
Prevent duplicate customers per store
*/
CustomerSchema.index(
  { store_id: 1, phone: 1 },
  { unique: true }
)

/*
Fast analytics queries
*/
CustomerSchema.index({ store_id: 1, total_spent: -1 })
CustomerSchema.index({ store_id: 1, total_orders: -1 })



module.exports = mongoose.model("Customer", CustomerSchema)