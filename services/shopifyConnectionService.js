const User = require("../models/user")
const Store = require("../models/store")


/*
--------------------------------
NORMALIZE CURRENCY
--------------------------------
*/

function normalizeCurrency(currency) {

  const normalized =

    String(

      currency || ""

    )

      .trim()

      .toUpperCase()


  if (!/^[A-Z]{3}$/.test(normalized)) {

    throw new Error(
      "Shopify store currency is required"
    )

  }


  return normalized

}


/*
--------------------------------
CONNECT SHOPIFY STORE
--------------------------------
*/

async function connectShopifyStore({

  shopDomain,

  shopId,

  shopName,

  shopEmail,

  accessToken,

  currency

}) {

  if (!shopDomain) {

    throw new Error(
      "Shopify shop domain is required"
    )

  }


  if (!shopId) {

    throw new Error(
      "Shopify shop ID is required"
    )

  }


  const normalizedCurrency =
    normalizeCurrency(
      currency
    )


  /*
  --------------------------------
  FIND EXISTING SHOPIFY STORE
  --------------------------------
  */

  let store =

    await Store.findOne({

      "shopify.shop_id":
        shopId

    })


  /*
  --------------------------------
  FALLBACK BY DOMAIN
  --------------------------------
  */

  if (!store) {

    store =

      await Store.findOne({

        "shopify.shop_domain":
          shopDomain

      })

  }


  /*
  --------------------------------
  UPDATE EXISTING CONNECTION
  --------------------------------
  */

  if (store) {

    store.platform =
      "shopify"

    store.platform_connected =
      true

    store.platform_connection_status =
      "connected"

    store.platform_sync_error =
      undefined

    /*
    --------------------------------
    STORE CURRENCY
    --------------------------------

    Shopify shop.currencyCode is the
    authoritative current currency
    for this connected store.
    --------------------------------
    */

    store.currency =
      normalizedCurrency


    store.shopify = {

      ...(store.shopify?.toObject

        ? store.shopify.toObject()

        : store.shopify || {}),

      shop_id:
        shopId,

      shop_domain:
        shopDomain,

      access_token:

        accessToken ||

        store.shopify?.access_token ||

        "",

      connected:
        true

    }


    if (shopName) {

      store.store_name =
        shopName

    }


    await store.save()


    return {

      store,

      created:
        false

    }

  }


  /*
  --------------------------------
  FIND EXISTING USER
  --------------------------------
  */

  let user = null


  if (shopEmail) {

    user =

      await User.findOne({

        email:
          shopEmail.toLowerCase()

      })

  }


  /*
  --------------------------------
  CREATE PLATFORM USER
  --------------------------------
  */

  if (!user) {

    const generatedEmail =

      shopEmail ||

      `${shopId

        .replace(

          /[^a-zA-Z0-9]/g,

          ""

        )}@shopify.ai-commerce.local`


    user =

      await User.create({

        name:

          shopName ||

          shopDomain,

        email:

          generatedEmail.toLowerCase(),

        password:
          null,

        plan:
          "free"

      })

  }


  /*
  --------------------------------
  CREATE STORE
  --------------------------------
  */

  store =

    await Store.create({

      merchant_id:
        user._id,

      store_name:

        shopName ||

        shopDomain,

      industry:
        "ecommerce",

      platform:
        "shopify",

      platform_connected:
        true,

      platform_connection_status:
        "connected",

      /*
      --------------------------------
      CURRENT SHOP CURRENCY
      --------------------------------
      */

      currency:
        normalizedCurrency,

      shopify: {

        shop_id:
          shopId,

        shop_domain:
          shopDomain,

        access_token:
          accessToken || "",

        connected:
          true

      },

      plan:
        user.plan || "free",

      subscription_status:
        "active",

      orders_used:
        0

    })


  return {

    store,

    user,

    created:
      true

  }

}


module.exports = {

  connectShopifyStore

}