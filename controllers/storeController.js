const Store = require("../models/Store")
const { getStoreLimit, getPlan } = require("../config/plans")



/*
--------------------------------
CREATE STORE
--------------------------------
Used in onboarding + multi-store
--------------------------------
*/

async function createStore(req, res) {

  try {

    const { store_name, merchant_phone } = req.body

    const userId = req.user.id
    const userPlan = req.user.plan || "free"

    // Validate input
    if (!store_name || !merchant_phone) {
      return res.status(400).json({
        error: "Store name and phone are required"
      })
    }


    /*
    --------------------------------
    CHECK PLAN LIMIT
    --------------------------------
    */

    const existingStores = await Store.find({
      merchant_id: userId
    })

    const storeLimit = getStoreLimit(userPlan)

    if (existingStores.length >= storeLimit) {
      return res.status(403).json({
        error: `You can only create ${storeLimit} store(s) on ${userPlan} plan`
      })
    }


    /*
    --------------------------------
    CREATE STORE
    --------------------------------
    */

    const planConfig = getPlan(userPlan)

    const store = await Store.create({

      merchant_id: userId,

      store_name,
      whatsapp_number: merchant_phone,

      /*
      PLAN SETTINGS
      */
      plan: userPlan,
      transaction_fee: planConfig.transaction_fee,

      /*
      USAGE TRACKING
      */
      orders_used: 0,

      /*
      BILLING
      */
      subscription_status: "active",
      subscription_renewal: null

    })


    res.status(201).json({
      message: "Store created successfully",
      store
    })

  } catch (error) {

    console.error("Create store error:", error)

    res.status(500).json({
      error: "Failed to create store"
    })

  }

}



/*
--------------------------------
GET ALL STORES (MULTI-STORE)
--------------------------------
*/

async function getStores(req, res) {

  try {

    const userId = req.user.id

    const stores = await Store.find({
      merchant_id: userId
    }).sort({ createdAt: 1 })


    res.status(200).json(stores)

  } catch (error) {

    console.error("Get stores error:", error)

    res.status(500).json({
      error: "Failed to fetch stores"
    })

  }

}



/*
--------------------------------
GET SINGLE STORE
--------------------------------
*/

async function getStore(req, res) {

  try {

    const store = await Store.findOne({
      _id: req.params.id,
      merchant_id: req.user.id
    })

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    res.status(200).json(store)

  } catch (error) {

    console.error("Get store error:", error)

    res.status(500).json({
      error: "Failed to fetch store"
    })

  }

}



/*
--------------------------------
UPDATE STORE
--------------------------------
*/

async function updateStore(req, res) {

  try {

    const updates = req.body

    const store = await Store.findOneAndUpdate(
      {
        _id: req.params.id,
        merchant_id: req.user.id
      },
      updates,
      { new: true, runValidators: true }
    )

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    res.status(200).json({
      message: "Store updated successfully",
      store
    })

  } catch (error) {

    console.error("Update store error:", error)

    res.status(500).json({
      error: "Failed to update store"
    })

  }

}



/*
--------------------------------
DELETE STORE
--------------------------------
*/

async function deleteStore(req, res) {

  try {

    const store = await Store.findOneAndDelete({
      _id: req.params.id,
      merchant_id: req.user.id
    })

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    res.status(200).json({
      message: "Store deleted successfully"
    })

  } catch (error) {

    console.error("Delete store error:", error)

    res.status(500).json({
      error: "Failed to delete store"
    })

  }

}



module.exports = {
  createStore,
  getStores,
  getStore,
  updateStore,
  deleteStore
}