const mongoose = require("mongoose")
const Store = require("../models/store")

async function loadStore(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: "Unauthorized"
      })
    }

    const store = await Store.findOne({
      merchant_id: req.user.id
    })

    if (!store) {
      console.log("❌ Store NOT found for user:", req.user.id)

      return res.status(404).json({
        error: "Store not found"
      })
    }

    req.store = store

    return next()

  } catch (error) {
    console.error("Store load error:", error.message)

    return res.status(500).json({
      error: "Failed to load store"
    })
  }
}

module.exports = loadStore