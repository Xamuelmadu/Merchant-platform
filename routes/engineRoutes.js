const express = require("express")
const router = express.Router()

const Store = require("../models/Store")


router.get("/merchant/:number", async (req,res)=>{

  const number = req.params.number

  const store = await Store.findOne({
    whatsapp_number:number
  })

  if(!store){
    return res.json(null)
  }

  res.json(store)

})

module.exports = router