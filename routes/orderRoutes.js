const express = require("express")
const router = express.Router()

const auth = require("../middleware/authMiddleware")
const loadStore = require("../middleware/loadStore")
const planGuard = require("../middleware/planGuard")

const orderController = require("../controllers/orderController")



/*
--------------------------------
CREATE ORDER
--------------------------------
Create new order and generate payment link
*/
router.post(
  "/create",
  auth,
  loadStore,
  planGuard,
  orderController.createOrder
)



/*
--------------------------------
RECENT ORDERS
--------------------------------
Used by financial dashboard
GET /orders/recent
*/
router.get(
  "/recent",
  auth,
  loadStore,
  orderController.getRecentOrders
)



/*
--------------------------------
ORDER LIST
--------------------------------
Get all orders for merchant
*/
router.get(
  "/",
  auth,
  loadStore,
  orderController.getOrders
)



/*
--------------------------------
GET SINGLE ORDER
--------------------------------
Useful for dashboard order details
*/
router.get(
  "/:id",
  auth,
  loadStore,
  orderController.getOrderById
)



/*
--------------------------------
UPDATE ORDER STATUS
--------------------------------
Used by admin or webhook processing
*/
router.patch(
  "/:id/status",
  auth,
  loadStore,
  orderController.updateOrderStatus
)



module.exports = router