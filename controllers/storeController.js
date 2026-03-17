const Store = require("../models/Store")



/*
Create Store
*/
async function createStore(req,res){

  try{

    const { store_name, merchant_phone } = req.body

    if(!store_name){
      return res.status(400).json({
        error:"Store name is required"
      })
    }

    const merchantId = req.user.id

    const existing = await Store.findOne({
      merchant_id: merchantId
    })

    if(existing){
      return res.json(existing)
    }

    const store = await Store.create({

      merchant_id: merchantId,
      store_name: store_name,
      whatsapp_number: merchant_phone

    })

    res.json(store)

  }catch(error){

    console.error("Create store error:",error)

    res.status(500).json({
      error:error.message
    })

  }

}



/*
Connect WhatsApp
*/
async function connectWhatsApp(req,res){

  const { whatsapp_number } = req.body

  const store = req.store

  store.whatsapp_number = whatsapp_number

  await store.save()

  res.json(store)

}



/*
Update Payments
*/
async function updatePayments(req,res){

  const store = req.store

  store.payments = {

    paystack_secret:req.body.paystack_secret,
    flutterwave_secret:req.body.flutterwave_secret,
    stripe_secret:req.body.stripe_secret

  }

  await store.save()

  res.json(store)

}



/*
Finish onboarding
*/
async function finishOnboarding(req,res){

  const store = req.store

  store.onboarding_complete = true

  await store.save()

  res.json(store)

}

async function getStore(req,res){

  try{

    const store = req.store

    if(!store){
      return res.status(404).json({
        error:"Store not found"
      })
    }

    res.json(store)

  }catch(error){

    res.status(500).json({
      error:error.message
    })

  }

}



module.exports = {

  createStore,
  connectWhatsApp,
  updatePayments,
  finishOnboarding,
  getStore
}