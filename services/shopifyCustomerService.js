const Customer =
  require("../models/customer")


/*
================================
SYNC SHOPIFY CUSTOMER
================================
*/

async function syncShopifyCustomer({
  store,
  customer
}) {

  if (!store) {
    throw new Error(
      "Store is required"
    )
  }

  if (!customer) {
    throw new Error(
      "Shopify customer is required"
    )
  }

  if (!customer.id) {
    throw new Error(
      "Shopify customer ID is required"
    )
  }


  const name =
    [
      customer.first_name,
      customer.last_name
    ]
      .filter(Boolean)
      .join(" ")
      .trim()


  const email =
    customer.email ||
    ""


  const phone =
    customer.phone ||
    ""


  const update = {

    store_id:
      store._id,

    source:
      "shopify",

    external_id:
      String(
        customer.id
      ),

    last_seen:
      new Date()

  }


  /*
  --------------------------------
  ONLY UPDATE PROFILE FIELDS
  WHEN SHOPIFY ACTUALLY PROVIDES
  THEM
  --------------------------------
  */

  if (name) {
    update.name = name
  }

  if (email) {
    update.email = email
  }

  if (phone) {
    update.phone = phone
  }


  const syncedCustomer =
    await Customer.findOneAndUpdate(

      {
        store_id:
          store._id,

        source:
          "shopify",

        external_id:
          String(
            customer.id
          )
      },

      {
        $set:
          update,

        $setOnInsert: {

          first_seen:
            new Date(),

          total_orders:
            0,

          total_spent:
            0,

          tags:
            []

        }

      },

      {
        upsert: true,

        new: true,

        setDefaultsOnInsert:
          true
      }

    )


  return syncedCustomer
}


/*
================================
DELETE SHOPIFY CUSTOMER
================================
*/

async function deleteShopifyCustomer({
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
      "Shopify customer ID is required"
    )
  }


  return Customer.deleteOne({

    store_id:
      store._id,

    source:
      "shopify",

    external_id:
      String(
        externalId
      )

  })

}


module.exports = {

  syncShopifyCustomer,

  deleteShopifyCustomer

}