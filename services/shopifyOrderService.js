const Order = require("../models/order")
const Customer = require("../models/customer")
const Product = require("../models/product")


/*
================================
HELPERS
================================
*/

function toNumber(value, fallback = 0) {

  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : fallback

}


function buildAddress(address) {

  if (!address) {
    return ""
  }

  return [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country
  ]
    .filter(Boolean)
    .join(", ")

}


/*
================================
FIND CUSTOMER
================================
*/

async function findShopifyCustomer({
  store,
  customer
}) {

  if (!customer?.id) {
    return null
  }

  return Customer.findOne({

    store_id:
      store._id,

    source:
      "shopify",

    external_id:
      String(customer.id)

  })

}


/*
================================
SYNC ORDER
================================
*/

async function syncShopifyOrder({
  store,
  order
}) {

  if (!store) {
    throw new Error(
      "Store is required"
    )
  }

  if (!order) {
    throw new Error(
      "Shopify order is required"
    )
  }

  if (!order.id) {
    throw new Error(
      "Shopify order ID is required"
    )
  }


  /*
  --------------------------------
  CUSTOMER
  --------------------------------
  */

  let customer = null

  if (order.customer?.id) {

    customer =
      await findShopifyCustomer({
        store,
        customer:
          order.customer
      })

  }


  /*
  --------------------------------
  CUSTOMER FALLBACK DATA
  --------------------------------
  */

  const customerName =
    [
      order.customer?.first_name,
      order.customer?.last_name
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    order.billing_address?.name ||
    order.shipping_address?.name ||
    ""


  const customerEmail =
    order.customer?.email ||
    order.email ||
    ""


  const customerPhone =
    order.customer?.phone ||
    order.shipping_address?.phone ||
    order.billing_address?.phone ||
    ""


  const customerAddress =
    buildAddress(
      order.shipping_address ||
      order.billing_address
    )


  /*
  --------------------------------
  ITEMS
  --------------------------------
  */

  const lineItems =
    Array.isArray(
      order.line_items
    )
      ? order.line_items
      : []


  const items = []


  for (
    const lineItem
    of lineItems
  ) {

    if (!lineItem) {
      continue
    }


    /*
    --------------------------------
    FIND LOCAL PRODUCT
    --------------------------------
    */

    let product = null


    if (
      lineItem.product_id
    ) {

      product =
        await Product.findOne({

          store_id:
            store._id,

          source:
            "shopify",

          external_id:
            String(
              lineItem.product_id
            )

        })

    }


    /*
    --------------------------------
    PRICE
    --------------------------------
    */

    const quantity =
      Math.max(
        1,
        toNumber(
          lineItem.quantity,
          1
        )
      )


    const unitPrice =
      toNumber(
        lineItem.price,
        0
      )


    const totalPrice =
      unitPrice *
      quantity


    items.push({

      product_id:
        product?._id,

      external_product_id:
        lineItem.product_id
          ? String(
              lineItem.product_id
            )
          : "",

      external_variant_id:
        lineItem.variant_id
          ? String(
              lineItem.variant_id
            )
          : "",

      name:
        lineItem.title ||
        lineItem.name ||
        "",

      variant_name:
        lineItem.variant_title ||
        "",

      sku:
        lineItem.sku ||
        "",

      quantity,

      unit_price:
        unitPrice,

      total_price:
        totalPrice

    })

  }


  /*
  --------------------------------
  TOTALS
  --------------------------------
  */

  const subtotal =
    toNumber(
      order.subtotal_price,
      0
    )


  const total =
    toNumber(
      order.total_price,
      0
    )


  /*
  --------------------------------
  CURRENCY
  --------------------------------
  */

  const currency =
    order.currency ||
    "USD"


  /*
  --------------------------------
  PAYMENT STATUS
  --------------------------------
  */

  let paymentStatus =
    "pending"


  if (
    order.financial_status ===
    "paid"
  ) {

    paymentStatus =
      "paid"

  } else if (
    order.financial_status ===
    "partially_paid"
  ) {

    paymentStatus =
      "partial"

  } else if (
    order.financial_status ===
    "refunded"
  ) {

    paymentStatus =
      "refunded"

  } else if (
    order.financial_status ===
    "voided"
  ) {

    paymentStatus =
      "cancelled"

  }


  /*
  --------------------------------
  ORDER STATUS
  --------------------------------
  */

  let orderStatus =
    "new"


  if (
    order.cancelled_at
  ) {

    orderStatus =
      "cancelled"

  } else if (
    order.fulfillment_status ===
    "fulfilled"
  ) {

    orderStatus =
      "completed"

  } else if (
    order.financial_status ===
      "paid" &&
    order.fulfillment_status ===
      "fulfilled"
  ) {

    orderStatus =
      "completed"

  } else if (
    order.financial_status ===
    "paid"
  ) {

    orderStatus =
      "paid"

  }


  /*
  --------------------------------
  ORDER DATE
  --------------------------------
  */

  const orderedAt =
    order.created_at
      ? new Date(
          order.created_at
        )
      : new Date()


  /*
  --------------------------------
  UPSERT ORDER
  --------------------------------
  */

  const syncedOrder =
    await Order.findOneAndUpdate(

      {

        store_id:
          store._id,

        source:
          "shopify",

        external_id:
          String(
            order.id
          )

      },

      {
        $set: {

          store_id:
            store._id,

          source:
            "shopify",

          external_id:
            String(
              order.id
            ),

          order_number:
            String(
              order.order_number ||
              order.name ||
              ""
            ),

          customer_id:
            customer?._id,

          external_customer_id:
            order.customer?.id
              ? String(
                  order.customer.id
                )
              : "",

          customer_name:
            customerName,

          customer_email:
            customerEmail,

          customer_phone:
            customerPhone,

          customer_address:
            customerAddress,

          items,

          /*
          --------------------------------
          LEGACY FIELDS
          --------------------------------
          */

          product_id:
            items.length === 1
              ? items[0].product_id
              : undefined,

          quantity:
            items.length === 1
              ? items[0].quantity
              : items.reduce(
                  (
                    total,
                    item
                  ) =>
                    total +
                    item.quantity,
                  0
                ),

          subtotal,

          total_price:
            total,

          currency,

          payment_status:
            paymentStatus,

          order_status:
            orderStatus,

          ordered_at:
            orderedAt,

          fulfilled_at:
            order.fulfillment_status ===
            "fulfilled"
              ? new Date()
              : undefined,

          cancelled_at:
            order.cancelled_at
              ? new Date(
                  order.cancelled_at
                )
              : undefined

        }

      },

      {
        upsert: true,

        new: true,

        setDefaultsOnInsert:
          true

      }

    )


  /*
  --------------------------------
  UPDATE CUSTOMER TOTALS
  --------------------------------

  Only recalculate when we have a
  Shopify customer record.
  --------------------------------
  */

  if (customer) {

    const customerOrders =
      await Order.find({

        store_id:
          store._id,

        customer_id:
          customer._id,

        source:
          "shopify",

        order_status: {
          $ne: "cancelled"
        }

      })
        .select(
          "total_price"
        )
        .lean()


    const totalOrders =
      customerOrders.length


    const totalSpent =
      customerOrders.reduce(
        (
          total,
          existingOrder
        ) =>
          total +
          toNumber(
            existingOrder.total_price
          ),
        0
      )


    await Customer.updateOne(

      {
        _id:
          customer._id
      },

      {
        $set: {

          total_orders:
            totalOrders,

          total_spent:
            totalSpent,

          last_seen:
            new Date()

        }

      }

    )

  }


  /*
  --------------------------------
  STORE SYNC STATE
  --------------------------------
  */

  const now =
    new Date()


  store.platform_last_sync =
    now

  store.platform_sync_error =
    undefined


  if (store.shopify) {

    store.shopify.last_order_sync =
      now

  }


  await store.save()


  return syncedOrder
}


/*
================================
DELETE ORDER
================================
*/

async function deleteShopifyOrder({
  store,
  externalId
}) {

  if (!store) {
    throw new Error(
      "Store is required"
    )
  }

  if (!externalId) {
    throw new Error(
      "Shopify order ID is required"
    )
  }


  const order =
    await Order.findOne({

      store_id:
        store._id,

      source:
        "shopify",

      external_id:
        String(
          externalId
        )

    })


  if (!order) {
    return null
  }


  const customerId =
    order.customer_id


  await Order.deleteOne({

    _id:
      order._id

  })


  /*
  --------------------------------
  RECALCULATE CUSTOMER
  --------------------------------
  */

  if (customerId) {

    const customerOrders =
      await Order.find({

        store_id:
          store._id,

        customer_id:
          customerId,

        source:
          "shopify",

        order_status: {
          $ne: "cancelled"
        }

      })
        .select(
          "total_price"
        )
        .lean()


    const totalSpent =
      customerOrders.reduce(
        (
          total,
          existingOrder
        ) =>
          total +
          toNumber(
            existingOrder.total_price
          ),
        0
      )


    await Customer.updateOne(

      {
        _id:
          customerId
      },

      {
        $set: {

          total_orders:
            customerOrders.length,

          total_spent:
            totalSpent

        }

      }

    )

  }


  return {
    deleted: true
  }

}


module.exports = {

  syncShopifyOrder,

  deleteShopifyOrder

}