const mongoose = require("mongoose")

const IntegrationSchema = new mongoose.Schema({
  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store"
  },

  provider: String,

  credentials: Object

}, {
  timestamps: true
})

module.exports = mongoose.model("Integration", IntegrationSchema)