const express = require("express")
const router = express.Router()

const auth = require("../middleware/auth")
const loadStore = require("../middleware/loadStore")

const storeController = require("../controllers/storeController")



/*
--------------------------------
STORE CREATION
--------------------------------
Used for onboarding + multi-store
--------------------------------
*/
router.post(
  "/create",
  auth,
  storeController.createStore
)



/*
--------------------------------
GET ALL STORES (MULTI-STORE)
--------------------------------
*/
router.get(
  "/",
  auth,
  storeController.getStores
)



/*
--------------------------------
GET SINGLE STORE
--------------------------------
*/
router.get(
  "/:id",
  auth,
  storeController.getStore
)



/*
--------------------------------
UPDATE STORE
--------------------------------
*/
router.patch(
  "/:id",
  auth,
  loadStore, // ensures store belongs to user
  storeController.updateStore
)



/*
--------------------------------
DELETE STORE
--------------------------------
*/
router.delete(
  "/:id",
  auth,
  loadStore, // ensures secure deletion
  storeController.deleteStore
)



module.exports = router