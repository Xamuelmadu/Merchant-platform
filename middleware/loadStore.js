const mongoose = require("mongoose")
const Store = require("../models/store")

async function loadStore(req, res, next) {

  try {

    /*
    --------------------------------
    AUTH CHECK
    --------------------------------
    */
    if (!req.user?.id) {
      return res.status(401).json({
        error: "Unauthorized"
      })
    }

    const userId = req.user.id

    /*
    --------------------------------
    GET STORE ID FROM HEADER
    --------------------------------
    */
    const storeId = req.headers["x-store-id"]

    let store = null

    /*
    --------------------------------
    PRIORITY: SELECTED STORE (MULTI-STORE)
    --------------------------------
    */
    if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {

      store = await Store.findOne({
        _id: new mongoose.Types.ObjectId(storeId),
        merchant_id: userId
      })

      if (!store) {
        console.warn("⚠️ Invalid store access attempt:", {
          userId,
          storeId
        })
      }
    }

    /*
    --------------------------------
    FALLBACK: DEFAULT STORE
    --------------------------------
    */
    if (!store) {

      store = await Store
        .findOne({ merchant_id: userId })
        .sort({ createdAt: 1 }) // oldest = default

    }

    /*
    --------------------------------
    NO STORE → ALLOW ONBOARDING FLOW
    --------------------------------
    */
    if (!store) {

      console.warn("⚠️ No store found for user:", userId)

      req.store = null

      return next() // DO NOT BLOCK (important for onboarding)
    }

    /*
    --------------------------------
    ATTACH STORE + META
    --------------------------------
    */
    req.store = store

    req.storeContext = {
      store_id: store._id,
      plan: store.plan,
      transaction_fee: store.transaction_fee
    }

    return next()

  } catch (error) {

    console.error("❌ Store load error:", error)

    return res.status(500).json({
      error: "Failed to load store"
    })

  }

}

module.exports = loadStore