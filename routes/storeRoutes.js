const express = require("express")
const router = express.Router()

const auth = require("../middleware/authMiddleware")
const storeController = require("../controllers/storeController")

router.post("/create", auth, storeController.createStore)

router.get("/", auth, storeController.getStores)

router.get("/:id", auth, storeController.getStore)

router.patch("/:id", auth, storeController.updateStore)

router.delete("/:id", auth, storeController.deleteStore)

module.exports = router