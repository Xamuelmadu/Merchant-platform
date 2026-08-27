const mongoose = require("mongoose")
const Store = require("../models/store")
const User = require("../models/user")

const {
  getStoreLimit,
  getPlan
} = require("../config/plan")


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

    // AUTO USE VERIFIED PHONE
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
    PLAN LIMIT CHECK
    --------------------------------
    */

    const storeLimit =
      getStoreLimit(userPlan)

    const currentCount =
      await Store.countDocuments({
        merchant_id: userId
      })

    if (currentCount >= storeLimit) {

      return res.status(403).json({
        error:
          `Store limit reached (${storeLimit}). Upgrade your plan.`,
        code: "STORE_LIMIT_REACHED"
      })

    }

    /*
    --------------------------------
    PLAN CONFIG
    --------------------------------
    */

    const planConfig =
      getPlan(userPlan)

    /*
    --------------------------------
    CREATE STORE
    --------------------------------
    */

    const store = await Store.create({

      merchant_id: userId,

      store_name:
        store_name.trim(),

      // AUTO LINK WHATSAPP
      whatsapp_number:
        merchant_phone || "",

      /*
      PLAN SNAPSHOT
      */

      plan: userPlan,

      transaction_fee:
        planConfig.transaction_fee,

      /*
      USAGE TRACKING
      */

      orders_used: 0,

      /*
      BILLING STATE
      */

      subscription_status:
        "active",

      subscription_renewal:
        null

    })

    return res.status(201).json({

      message:
        "Store created successfully",

      store

    })

  } catch (error) {

    console.error(
      "Create store error:",
      error.message
    )

    return res.status(500).json({
      error:
        "Failed to create store"
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

    const userId =
      req.user.id

    const userPlan =
      req.user.plan || "free"

    const stores =
      await Store.find({
        merchant_id: userId
      }).sort({
        createdAt: 1
      })

    return res.status(200).json({

      stores,

      meta: {

        total:
          stores.length,

        limit:
          getStoreLimit(userPlan),

        plan:
          userPlan

      }

    })

  } catch (error) {

    console.error(
      "Get stores error:",
      error.message
    )

    return res.status(500).json({
      error:
        "Failed to fetch stores"
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

    const store =
      await Store.findOne({

        _id:
          req.params.id,

        merchant_id:
          req.user.id

      })

    if (!store) {

      return res.status(404).json({
        error:
          "Store not found"
      })

    }

    return res.status(200).json(
      store
    )

  } catch (error) {

    console.error(
      "Get store error:",
      error.message
    )

    return res.status(500).json({
      error:
        "Failed to fetch store"
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

    const store =
      await Store.findOneAndUpdate(

        {
          _id:
            req.params.id,

          merchant_id:
            req.user.id
        },

        updates,

        {
          new: true,
          runValidators: true
        }

      )

    if (!store) {

      return res.status(404).json({
        error:
          "Store not found"
      })

    }

    return res.status(200).json({

      message:
        "Store updated successfully",

      store

    })

  } catch (error) {

    console.error(
      "Update store error:",
      error.message
    )

    return res.status(500).json({
      error:
        "Failed to update store"
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

    const userId =
      req.user.id

    const totalStores =
      await Store.countDocuments({
        merchant_id: userId
      })

    /*
    Prevent deleting last store
    */

    if (totalStores <= 1) {

      return res.status(400).json({
        error:
          "You must have at least one store"
      })

    }

    const store =
      await Store.findOneAndDelete({

        _id:
          req.params.id,

        merchant_id:
          userId

      })

    if (!store) {

      return res.status(404).json({
        error:
          "Store not found"
      })

    }

    return res.status(200).json({
      message:
        "Store deleted successfully"
    })

  } catch (error) {

    console.error(
      "Delete store error:",
      error.message
    )

    return res.status(500).json({
      error:
        "Failed to delete store"
    })

  }

}


/*
--------------------------------
SAVE PAYMENT SETTINGS
--------------------------------
*/

async function savePaymentSettings(
  req,
  res
) {

  try {

    const {

      paystack_public_key,
      paystack_secret_key,

      stripe_public_key,
      stripe_secret_key

    } = req.body

    const storeId =
      req.body.store_id

    const store =
      await Store.findOne({

        _id:
          storeId,

        merchant_id:
          req.user.id

      })

    if (!store) {

      return res.status(404).json({
        error:
          "Store not found"
      })

    }

    /*
    SAVE KEYS
    */

    store.paystack_public_key =
      paystack_public_key || ""

    store.paystack_secret_key =
      paystack_secret_key || ""

    store.stripe_public_key =
      stripe_public_key || ""

    store.stripe_secret_key =
      stripe_secret_key || ""

    await store.save()

    return res.json({

      success: true,

      message:
        "Payment settings saved"

    })

  } catch (error) {

    console.error(
      "Save payment settings error:",
      error.message
    )

    return res.status(500).json({

      error:
        "Failed to save payment settings"

    })

  }

}


/*
--------------------------------
CONNECT SHOPIFY STORE
--------------------------------

Called by the Shopify app after
Shopify authentication.

This connects the Shopify store
to the existing AI Commerce User
and Store models.

No separate Shopify merchant
model is created.
--------------------------------
*/

async function connectShopify(
  req,
  res
) {

  try {

    const {
      shop_id,
      shop_domain,
      shop_name,
      shop_email,
      access_token
    } = req.body


    /*
    --------------------------------
    VALIDATION
    --------------------------------
    */

    if (
      !shop_id ||
      !shop_domain ||
      !access_token
    ) {

      return res.status(400).json({

        error:
          "Shopify shop information is incomplete"

      })

    }


    /*
    --------------------------------
    NORMALIZE DOMAIN
    --------------------------------
    */

    const normalizedDomain =
      String(shop_domain)
        .trim()
        .toLowerCase()


    /*
    --------------------------------
    FIND EXISTING SHOP
    --------------------------------
    */

    let store =
      await Store.findOne({

        $or: [

          {
            "shopify.shop_id":
              shop_id
          },

          {
            "shopify.shop_domain":
              normalizedDomain
          }

        ]

      })


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

    let user = null

    if (shop_email) {

      user =
        await User.findOne({

          email:
            String(shop_email)
              .trim()
              .toLowerCase()

        })

    }


    /*
    --------------------------------
    EXISTING SHOP
    --------------------------------
    */

    if (store) {

      /*
      If the store already belongs to
      another user, do not reassign it.
      */

      if (
        store.merchant_id &&
        String(store.merchant_id) !==
          String(user?._id)
      ) {

        return res.status(409).json({

          error:
            "This Shopify store is already connected to another account"

        })

      }


      /*
      If there is no user yet, create
      one from Shopify merchant data.
      */

      if (!user) {

        if (!shop_email) {

          return res.status(400).json({

            error:
              "Shopify shop email is required"

          })

        }

        user =
          await User.create({

            name:
              shop_name ||
              normalizedDomain,

            email:
              String(shop_email)
                .trim()
                .toLowerCase(),

            password:
              null,

            plan:
              "free"

          })

      }


      /*
      Update existing connection.
      */

      store.merchant_id =
        user._id

      store.store_name =
        shop_name ||
        store.store_name ||
        normalizedDomain

      store.platform =
        "shopify"

      store.platform_connected =
        true

      store.platform_connection_status =
        "connected"

      store.platform_last_sync =
        new Date()

      store.shopify = {

        ...(store.shopify?.toObject
          ? store.shopify.toObject()
          : store.shopify || {}),

        shop_id,

        shop_domain:
          normalizedDomain,

        access_token,

        connected:
          true

      }

      await store.save()

    } else {

      /*
      --------------------------------
      NO EXISTING SHOP
      --------------------------------
      */

      /*
      Shopify merchant identity is
      represented by the existing User
      model.
      */

      if (!user) {

        if (!shop_email) {

          return res.status(400).json({

            error:
              "Shopify shop email is required"

          })

        }

        user =
          await User.create({

            name:
              shop_name ||
              normalizedDomain,

            email:
              String(shop_email)
                .trim()
                .toLowerCase(),

            password:
              null,

            plan:
              "free"

          })

      }


      /*
      --------------------------------
      CHECK USER STORE LIMIT
      --------------------------------
      */

      const userPlan =
        user.plan || "free"

      const storeLimit =
        getStoreLimit(userPlan)

      const currentCount =
        await Store.countDocuments({

          merchant_id:
            user._id

        })

      if (
        currentCount >=
        storeLimit
      ) {

        return res.status(403).json({

          error:
            `Store limit reached (${storeLimit}). Upgrade your plan.`,

          code:
            "STORE_LIMIT_REACHED"

        })

      }


      /*
      --------------------------------
      PLAN CONFIG
      --------------------------------
      */

      const planConfig =
        getPlan(userPlan)


      /*
      --------------------------------
      CREATE SHOPIFY STORE
      --------------------------------
      */

      store =
        await Store.create({

          merchant_id:
            user._id,

          store_name:
            shop_name ||
            normalizedDomain,

          industry:
            "ecommerce",

          platform:
            "shopify",

          platform_connected:
            true,

          platform_connection_status:
            "connected",

          platform_last_sync:
            new Date(),

          shopify: {

            shop_id,

            shop_domain:
              normalizedDomain,

            access_token,

            connected:
              true,

            last_product_sync:
              null,

            last_order_sync:
              null,

            last_inventory_sync:
              null

          },

          plan:
            userPlan,

          transaction_fee:
            planConfig.transaction_fee,

          orders_used:
            0,

          subscription_status:
            "active",

          subscription_renewal:
            null

        })

    }


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    return res.status(200).json({

      success:
        true,

      message:
        "Shopify store connected successfully",

      user: {

        id:
          user._id,

        name:
          user.name,

        email:
          user.email,

        plan:
          user.plan

      },

      store: {

        id:
          store._id,

        name:
          store.store_name,

        platform:
          store.platform,

        platform_connected:
          store.platform_connected,

        platform_connection_status:
          store.platform_connection_status

      }

    })

  } catch (error) {

    console.error(
      "Shopify connection error:",
      error
    )

    return res.status(500).json({

      error:
        "Failed to connect Shopify store"

    })

  }

}


module.exports = {

  createStore,

  getStores,

  getStore,

  updateStore,

  deleteStore,

  savePaymentSettings,

  connectShopify

}