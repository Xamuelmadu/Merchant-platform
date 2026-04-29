const mongoose = require("mongoose")
const Store = require("../models/store")
const { getStoreLimit, getPlan } = require("../config/plan")



/*
--------------------------------
CREATE STORE
--------------------------------
*/

async function createStore(req, res) {

  try {

    const { store_name } = req.body

    const userId = req.user.id
    const userPlan = req.user.plan || "free"

    // 🔥 AUTO USE VERIFIED PHONE
    const merchant_phone = req.user.phone

    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */
    if (!store_name) {
      return res.status(400).json({
        error: "Store name is required"
      })
    }

    /*
    --------------------------------
    PLAN LIMIT CHECK (SAFE)
    --------------------------------
    */
    const storeLimit = getStoreLimit(userPlan)

    const currentCount = await Store.countDocuments({
      merchant_id: userId
    })

    if (currentCount >= storeLimit) {
      return res.status(403).json({
        error: `Store limit reached (${storeLimit}). Upgrade your plan.`,
        code: "STORE_LIMIT_REACHED"
      })
    }

    /*
    --------------------------------
    PLAN CONFIG
    --------------------------------
    */
    const planConfig = getPlan(userPlan)

    /*
    --------------------------------
    CREATE STORE
    --------------------------------
    */
    const store = await Store.create({

      merchant_id: userId,

      store_name: store_name.trim(),

      // 🔥 AUTO LINK WHATSAPP
      whatsapp_number: merchant_phone || "",

      /*
      PLAN SNAPSHOT
      */
      plan: userPlan,
      transaction_fee: planConfig.transaction_fee,

      /*
      USAGE TRACKING
      */
      orders_used: 0,

      /*
      BILLING STATE
      */
      subscription_status: "active",
      subscription_renewal: null

    })

    return res.status(201).json({
      message: "Store created successfully",
      store
    })

  } catch (error) {

    console.error("Create store error:", error.message)

    return res.status(500).json({
      error: "Failed to create store"
    })

  }

}



/*
--------------------------------
GET ALL STORES
--------------------------------
*/

async function getStores(req, res) {

  try {

    const userId = req.user.id
    const userPlan = req.user.plan || "free"

    const stores = await Store.find({
      merchant_id: userId
    }).sort({ createdAt: 1 })

    /*
    --------------------------------
    RETURN WITH PLAN META (frontend needs this)
    --------------------------------
    */
    return res.status(200).json({
      stores,
      meta: {
        total: stores.length,
        limit: getStoreLimit(userPlan),
        plan: userPlan
      }
    })

  } catch (error) {

    console.error("Get stores error:", error.message)

    return res.status(500).json({
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

    return res.status(200).json(store)

  } catch (error) {

    console.error("Get store error:", error.message)

    return res.status(500).json({
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

    /*
    Prevent critical overrides
    */
    delete updates.merchant_id
    delete updates.plan
    delete updates.transaction_fee

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

    return res.status(200).json({
      message: "Store updated successfully",
      store
    })

  } catch (error) {

    console.error("Update store error:", error.message)

    return res.status(500).json({
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

    const userId = req.user.id

    const totalStores = await Store.countDocuments({
      merchant_id: userId
    })

    /*
    Prevent deleting last store (important UX/business rule)
    */
    if (totalStores <= 1) {
      return res.status(400).json({
        error: "You must have at least one store"
      })
    }

    const store = await Store.findOneAndDelete({
      _id: req.params.id,
      merchant_id: userId
    })

    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }

    return res.status(200).json({
      message: "Store deleted successfully"
    })

  } catch (error) {

    console.error("Delete store error:", error.message)

    return res.status(500).json({
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