const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema({

  store_id:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Store"
  },

  name:String,

  description:String,

  price:Number,

  stock:Number,

  images:[String],

  product_url:String,

  source:{
    type:String,
    default:"manual"
  },

  created_at:{
    type:Date,
    default:Date.now
  }

})

module.exports = mongoose.model("Product",ProductSchema)