const mongoose = require("mongoose")

const OrderSchema = new mongoose.Schema({

  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store"
  },

  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  },

  customer_name: String,
  customer_phone: String,
  customer_address: String,

  quantity: Number,
  total_price: Number,

  payment_reference: String,

  payment_status: {
    type: String,
    default: "pending"
  },

  order_status: {
    type: String,
    default: "new"
  }

}, {
  timestamps: true
})

module.exports = mongoose.model("Order", OrderSchema)