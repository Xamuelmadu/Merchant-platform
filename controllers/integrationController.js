const Store = require("../models/Store")



/*
--------------------------------
GET PAYMENT SETTINGS
--------------------------------
GET /integrations/payments
--------------------------------
*/

async function getPayments(req,res){

  try{

    const store = req.store

    if(!store){
      return res.status(404).json({
        error:"Store not found"
      })
    }

    res.json({

      stripe_enabled: !!store.stripe_public_key,

      stripe_public_key: store.stripe_public_key || "",

      paystack_enabled: !!store.paystack_public_key,

      paystack_public_key: store.paystack_public_key || ""

    })

  }catch(error){

    console.error("Get payments error:", error)

    res.status(500).json({
      error:"Failed to load payment settings"
    })

  }

}



/*
--------------------------------
UPDATE PAYMENT SETTINGS
--------------------------------
POST /integrations/payments/update
--------------------------------
*/

async function updatePayments(req,res){

  try{

    const store = req.store

    const {
      stripe_public_key,
      stripe_secret_key,
      paystack_public_key,
      paystack_secret_key
    } = req.body

    if(!store){
      return res.status(404).json({
        error:"Store not found"
      })
    }

    if(stripe_public_key !== undefined){
      store.stripe_public_key = stripe_public_key
    }

    if(stripe_secret_key !== undefined){
      store.stripe_secret_key = stripe_secret_key
    }

    if(paystack_public_key !== undefined){
      store.paystack_public_key = paystack_public_key
    }

    if(paystack_secret_key !== undefined){
      store.paystack_secret_key = paystack_secret_key
    }

    await store.save()

    res.json({
      message:"Payment settings updated"
    })

  }catch(error){

    console.error("Update payments error:", error)

    res.status(500).json({
      error:"Unable to update payment settings"
    })

  }

}



module.exports = {
  getPayments,
  updatePayments
}