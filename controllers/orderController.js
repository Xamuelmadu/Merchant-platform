const Store = require("../models/store")
const Product = require("../models/product")
const Order = require("../models/order")

const { checkUsageLimit } =
  require("../services/usageGuard")

const { enforceSubscription } =
  require("../services/subscriptionGuard")



/*
================================
STORE CURRENCY HELPER
================================

The Store is the canonical owner
of the currency used for commerce.

Orders copy the Store currency at
the time the order is created.

This preserves historical financial
accuracy if the store currency is
changed later.
================================
*/

function getStoreCurrency(store) {

  return (
    String(
      store?.currency ||
      "USD"
    )
      .trim()
      .toUpperCase()
  )

}



/*
================================
CREATE ORDER
================================

IMPORTANT:

Guava no longer processes customer
payments directly from this endpoint.

The customer uses the merchant's
native Shopify or WooCommerce
checkout/payment gateway.

This endpoint is therefore only
responsible for creating a Guava
order record when required.
================================
*/

async function createOrder(req, res) {

  try {

    const {
      product_id,
      quantity = 1,
      customer_name,
      customer_email = "",
      customer_phone,
      customer_address,
      source = "custom",
      external_id = "",
      order_number = ""
    } = req.body


    /*
    --------------------------------
    VALIDATE PRODUCT
    --------------------------------
    */

    if (!product_id) {

      return res.status(400).json({

        success: false,

        error:
          "product_id is required"

      })

    }


    /*
    --------------------------------
    VALIDATE QUANTITY
    --------------------------------
    */

    const parsedQuantity =
      Number(quantity)


    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity < 1
    ) {

      return res.status(400).json({

        success: false,

        error:
          "quantity must be a positive integer"

      })

    }


    /*
    --------------------------------
    VALIDATE SOURCE
    --------------------------------
    */

    const validSources = [
      "shopify",
      "woocommerce",
      "custom",
      "manual"
    ]


    if (
      !validSources.includes(
        source
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid order source"

      })

    }


    /*
    --------------------------------
    SUBSCRIPTION GUARD
    --------------------------------
    */

    await enforceSubscription(
      req.user.id
    )


    /*
    --------------------------------
    PLAN LIMIT GUARD
    --------------------------------
    */

    const store =
      await checkUsageLimit(
        req.user.id
      )


    /*
    --------------------------------
    FIND PRODUCT
    --------------------------------
    */

    const product =
      await Product.findOne({

        _id:
          product_id,

        store_id:
          store._id

      })


    if (!product) {

      return res.status(404).json({

        success: false,

        error:
          "Product not found"

      })

    }


    /*
    --------------------------------
    INVENTORY CHECK
    --------------------------------

    Only enforce inventory when the
    product has an actual stock value.

    This prevents breaking products
    that use external inventory
    management such as Shopify or
    WooCommerce.
    --------------------------------
    */

    if (
      product.stock !== undefined &&
      product.stock !== null &&
      Number.isFinite(
        Number(product.stock)
      ) &&
      Number(product.stock) <
        parsedQuantity
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Insufficient product stock",

        available_stock:
          Number(product.stock)

      })

    }


    /*
    --------------------------------
    CURRENCY
    --------------------------------
    */

    const currency =
      getStoreCurrency(store)


    /*
    --------------------------------
    CALCULATE TOTALS
    --------------------------------
    */

    const unitPrice =
      Number(product.price) || 0


    const subtotal =
      unitPrice *
      parsedQuantity


    const total =
      subtotal


    const feeRate =
      store.transaction_fee ??
      0.007


    const platformFee =
      total *
      feeRate


    const merchantPayout =
      total -
      platformFee


    /*
    --------------------------------
    CREATE ORDER
    --------------------------------

    This is a Guava order record.

    Payment remains pending because
    Guava is NOT processing payment.

    Shopify/WooCommerce handles the
    actual checkout and payment.
    --------------------------------
    */

    const order =
      await Order.create({

        store_id:
          store._id,

        source,

        external_id:
          external_id || "",

        order_number:
          order_number || "",

        customer_name:
          customer_name || "",

        customer_email:
          customer_email || "",

        customer_phone:
          customer_phone || "",

        customer_address:
          customer_address || "",


        /*
        --------------------------------
        ORDER ITEMS
        --------------------------------
        */

        items: [

          {

            product_id:
              product._id,

            external_product_id:
              product.external_id ||
              "",

            name:
              product.name ||
              "",

            sku:
              product.sku ||
              "",

            quantity:
              parsedQuantity,

            unit_price:
              unitPrice,

            total_price:
              subtotal

          }

        ],


        /*
        --------------------------------
        LEGACY COMPATIBILITY
        --------------------------------
        */

        product_id:
          product._id,

        quantity:
          parsedQuantity,


        /*
        --------------------------------
        FINANCIAL SNAPSHOT
        --------------------------------
        */

        subtotal,

        total_price:
          total,

        currency,

        platform_fee:
          platformFee,

        merchant_payout:
          merchantPayout,


        /*
        --------------------------------
        PAYMENT
        --------------------------------

        Guava does not collect the
        payment here.

        The native Shopify or
        WooCommerce checkout owns
        payment state.
        --------------------------------
        */

        payment_status:
          "pending",

        payment_reference:
          "",

        payment_gateway:
          "",


        /*
        --------------------------------
        ORDER STATUS
        --------------------------------
        */

        order_status:
          "new",

        ordered_at:
          new Date()

      })


    /*
    --------------------------------
    UPDATE STORE USAGE
    --------------------------------
    */

    store.orders_used =
      (store.orders_used || 0) + 1


    await store.save()


    /*
    --------------------------------
    RESPONSE
    --------------------------------

    There is deliberately NO:

    payment_link
    payment_reference
    payment_gateway

    because Guava does not initiate
    payment for this flow.
    --------------------------------
    */

    return res.status(201).json({

      success: true,

      message:
        "Order created successfully",

      order,

      checkout:
        null,

      payment_required:
        false,

      payment_processing:
        "merchant_native_checkout"

    })


  } catch (error) {

    console.error(
      "Create order error:",
      error
    )


    return res.status(500).json({

      success: false,

      error:
        "Order creation failed",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
GET ALL ORDERS
================================
*/

async function getOrders(req, res) {

  try {

    const store =
      req.store


    const orders =
      await Order

        .find({
          store_id:
            store._id
        })

        .populate(
          "product_id"
        )

        .sort({
          created_at:
            -1
        })


    return res.json(
      orders
    )


  } catch (error) {

    console.error(
      "Get orders error:",
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Unable to fetch orders",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
GET SINGLE ORDER
================================
*/

async function getOrderById(
  req,
  res
) {

  try {

    const store =
      req.store


    const order =
      await Order

        .findOne({

          _id:
            req.params.id,

          store_id:
            store._id

        })

        .populate(
          "product_id"
        )


    if (!order) {

      return res.status(404).json({

        success: false,

        error:
          "Order not found"

      })

    }


    return res.json(
      order
    )


  } catch (error) {

    console.error(
      "Get order error:",
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Unable to fetch order",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
UPDATE ORDER STATUS
================================

Used by:

- Admin
- Shopify synchronization
- WooCommerce synchronization
- Internal order processing
- Fulfillment workflows
================================
*/

async function updateOrderStatus(
  req,
  res
) {

  try {

    const {
      status
    } = req.body


    const validStatuses = [

      "new",

      "paid",

      "completed",

      "cancelled"

    ]


    if (
      !validStatuses.includes(
        status
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid status"

      })

    }


    /*
    --------------------------------
    FIND ORDER
    --------------------------------
    */

    const order =
      await Order.findOne({

        _id:
          req.params.id,

        store_id:
          req.store._id

      })


    if (!order) {

      return res.status(404).json({

        success: false,

        error:
          "Order not found"

      })

    }


    /*
    --------------------------------
    UPDATE ORDER STATUS
    --------------------------------
    */

    order.order_status =
      status


    /*
    --------------------------------
    PAYMENT STATE
    --------------------------------

    Payment is only marked paid when
    the external commerce platform has
    confirmed the payment/order state.

    This controller does NOT verify
    Paystack or Flutterwave payments.
    --------------------------------
    */

    if (
      status === "paid" ||
      status === "completed"
    ) {

      order.payment_status =
        "paid"

    }


    if (
      status === "cancelled"
    ) {

      order.payment_status =
        order.payment_status ===
        "paid"
          ? "paid"
          : "cancelled"

      order.cancelled_at =
        new Date()

    }


    if (
      status === "completed"
    ) {

      order.fulfilled_at =
        order.fulfilled_at ||
        new Date()

    }


    await order.save()


    return res.json({

      success: true,

      message:
        "Order status updated",

      order

    })


  } catch (error) {

    console.error(
      "Update order status error:",
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Unable to update order status",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
RECENT COMPLETED ORDERS
================================

Used by the financial dashboard.
================================
*/

async function getRecentOrders(
  req,
  res
) {

  try {

    const store =
      req.store


    const orders =
      await Order.find({

        store_id:
          store._id,

        order_status:
          "completed"

      })

      .sort({
        created_at:
          -1
      })

      .limit(20)


    return res.json(
      orders
    )


  } catch (error) {

    console.error(
      "Get recent orders error:",
      error.message
    )


    return res.status(500).json({

      success: false,

      error:
        "Unable to fetch recent orders",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
INTERNAL AI ORDER CREATION
================================

Used by the AI Commerce Engine.

The AI Engine does not use merchant
JWT authentication, so this endpoint
uses the internal platform key.

IMPORTANT:

This endpoint creates the canonical
Guava order record.

It does NOT create a Paystack,
Flutterwave, or Stripe payment.

The AI Commerce Engine should instead
return/use the merchant's native
Shopify or WooCommerce checkout URL.
================================
*/

async function createInternalOrder(
  req,
  res
) {

  try {

    /*
    --------------------------------
    INTERNAL AUTH
    --------------------------------
    */

    const platformKey =
      req.headers[
        "x-platform-key"
      ]


    if (
      !process.env
        .AI_COMMERCE_PLATFORM_KEY ||
      platformKey !==
        process.env
          .AI_COMMERCE_PLATFORM_KEY
    ) {

      return res.status(401).json({

        success: false,

        error:
          "Unauthorized platform request"

      })

    }


    /*
    --------------------------------
    REQUEST DATA
    --------------------------------
    */

    const {

      store_id,

      product_id,

      quantity = 1,

      customer_id,

      external_customer_id,

      customer_name = "",

      customer_email = "",

      customer_phone = "",

      customer_address = "",

      source = "custom",

      external_id = "",

      order_number = ""

    } = req.body


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (!store_id) {

      return res.status(400).json({

        success: false,

        error:
          "store_id is required"

      })

    }


    if (!product_id) {

      return res.status(400).json({

        success: false,

        error:
          "product_id is required"

      })

    }


    const parsedQuantity =
      Number(quantity)


    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity < 1
    ) {

      return res.status(400).json({

        success: false,

        error:
          "quantity must be a positive integer"

      })

    }


    const validSources = [

      "shopify",

      "woocommerce",

      "custom",

      "manual"

    ]


    if (
      !validSources.includes(
        source
      )
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Invalid order source"

      })

    }


    /*
    --------------------------------
    FIND STORE
    --------------------------------
    */

    const store =
      await Store.findById(
        store_id
      )


    if (!store) {

      return res.status(404).json({

        success: false,

        error:
          "Store not found"

      })

    }


    /*
    --------------------------------
    FIND PRODUCT
    --------------------------------
    */

    const product =
      await Product.findOne({

        _id:
          product_id,

        store_id:
          store._id

      })


    if (!product) {

      return res.status(404).json({

        success: false,

        error:
          "Product not found"

      })

    }


    /*
    --------------------------------
    INVENTORY CHECK
    --------------------------------

    Do not enforce stock if the
    merchant's external commerce
    platform is responsible for
    inventory.
    --------------------------------
    */

    const usesExternalInventory =
      source === "shopify" ||
      source === "woocommerce"


    if (
      !usesExternalInventory &&
      product.stock !== undefined &&
      product.stock !== null &&
      Number.isFinite(
        Number(product.stock)
      ) &&
      Number(product.stock) <
        parsedQuantity
    ) {

      return res.status(400).json({

        success: false,

        error:
          "Insufficient product stock",

        available_stock:
          Number(product.stock)

      })

    }


    /*
    --------------------------------
    CALCULATE TOTALS
    --------------------------------
    */

    const unitPrice =
      Number(product.price) ||
      0


    const subtotal =
      unitPrice *
      parsedQuantity


    const total =
      subtotal


    const currency =
      getStoreCurrency(
        store
      )


    const feeRate =
      store.transaction_fee ??
      0.007


    const platformFee =
      total *
      feeRate


    const merchantPayout =
      total -
      platformFee


    /*
    --------------------------------
    CREATE CANONICAL ORDER
    --------------------------------
    */

    const order =
      await Order.create({

        store_id:
          store._id,

        source,

        external_id:
          external_id || "",

        order_number:
          order_number || "",


        /*
        --------------------------------
        CUSTOMER
        --------------------------------
        */

        customer_id:
          customer_id ||
          undefined,

        external_customer_id:
          external_customer_id ||
          "",

        customer_name,

        customer_email,

        customer_phone,

        customer_address,


        /*
        --------------------------------
        ORDER ITEMS
        --------------------------------
        */

        items: [

          {

            product_id:
              product._id,

            external_product_id:
              product.external_id ||
              "",

            name:
              product.name ||
              "",

            sku:
              product.sku ||
              "",

            quantity:
              parsedQuantity,

            unit_price:
              unitPrice,

            total_price:
              subtotal

          }

        ],


        /*
        --------------------------------
        LEGACY COMPATIBILITY
        --------------------------------
        */

        product_id:
          product._id,

        quantity:
          parsedQuantity,


        /*
        --------------------------------
        FINANCIAL SNAPSHOT
        --------------------------------
        */

        subtotal,

        total_price:
          total,

        currency,

        platform_fee:
          platformFee,

        merchant_payout:
          merchantPayout,


        /*
        --------------------------------
        PAYMENT
        --------------------------------
        */

        payment_status:
          "pending",

        payment_reference:
          "",

        payment_gateway:
          "",


        /*
        --------------------------------
        ORDER STATUS
        --------------------------------
        */

        order_status:
          "new",

        ordered_at:
          new Date()

      })


    /*
    --------------------------------
    UPDATE STORE USAGE
    --------------------------------
    */

    store.orders_used =
      (store.orders_used || 0) + 1


    await store.save()


    /*
    --------------------------------
    RESPONSE
    --------------------------------

    No payment link is generated.

    The AI Commerce layer should use
    the merchant's Shopify/WooCommerce
    native checkout separately.
    --------------------------------
    */

    return res.status(201).json({

      success: true,

      message:
        "Order created successfully",

      order,

      checkout: {

        provider:
          source === "shopify"
            ? "shopify"
            : source ===
              "woocommerce"
              ? "woocommerce"
              : null,

        native:
          true

      },

      payment_processing:
        "merchant_native_checkout"

    })


  } catch (error) {

    console.error(
      "Internal order creation error:",
      error
    )


    return res.status(500).json({

      success: false,

      error:
        "Order creation failed",

      details:
        process.env.NODE_ENV ===
        "production"
          ? undefined
          : error.message

    })

  }

}



/*
================================
EXPORTS
================================
*/

module.exports = {

  createOrder,

  createInternalOrder,

  getOrders,

  getOrderById,

  updateOrderStatus,

  getRecentOrders

}