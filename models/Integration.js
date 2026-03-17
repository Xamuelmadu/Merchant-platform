const mongoose = require("mongoose")

const IntegrationSchema = new mongoose.Schema({

  store_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Store"
  },

  provider:String,

  credentials:Object,

  created_at:{
    type:Date,
    default:Date.now
  }

})

module.exports = mongoose.model("Integration",IntegrationSchema)