const Store = require("../models/Store")

async function checkSubscription(req,res,next){

  const store = await Store.findOne({
    merchant_id:req.user.id
  })

  if(store.system_locked){

    return res.status(403).json({
      error:"Subscription expired. Please pay invoice."
    })

  }

  next()

}

module.exports = checkSubscription