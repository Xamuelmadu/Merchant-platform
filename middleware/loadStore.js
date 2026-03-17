const mongoose = require("mongoose")
const Store = require("../models/Store")

async function loadStore(req, res, next) {

  try {

    if (!req.user?.id) {
      return res.status(401).json({
        error: "Unauthorized"
      })
    }

    const store = await Store.findOne({
      merchant_id: new mongoose.Types.ObjectId(req.user.id)
    })

    if (!store) {

      console.log("❌ Store NOT found for user:", req.user.id)

      return res.status(404).json({
        error: "Store not found"
      })
    }

    req.store = store

    next()

  } catch (error) {

    console.error("Store load error:", error)

    res.status(500).json({
      error: "Failed to load store"
    })

  }

}

module.exports = loadStore