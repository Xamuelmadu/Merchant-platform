const crypto = require("crypto")

const Store =
  require("../models/store")


function woocommercePluginAuth(
  req,
  res,
  next
) {

  try {

    const providedCredential =
      req.headers[
        "x-ai-commerce-credential"
      ]


    if (!providedCredential) {

      return res.status(401).json({

        success:
          false,

        error:
          "WooCommerce plugin credential is required"

      })

    }


    /*
    --------------------------------
    HASH PROVIDED CREDENTIAL
    --------------------------------
    */

    const credentialHash =
      crypto
        .createHash(
          "sha256"
        )
        .update(
          String(
            providedCredential
          )
        )
        .digest(
          "hex"
        )


    /*
    --------------------------------
    FIND CONNECTED WOOCOMMERCE STORE
    --------------------------------
    */

    Store.findOne({

      "woocommerce.plugin_credential_hash":
        credentialHash,

      platform:
        "woocommerce",

      platform_connected:
        true,

      "woocommerce.connected":
        true

    })
      .then(store => {

        if (!store) {

          return res.status(401).json({

            success:
              false,

            error:
              "Invalid WooCommerce plugin credential"

          })

        }


        /*
        --------------------------------
        TRUSTED STORE CONTEXT
        --------------------------------
        */

        req.woocommerceStore =
          store


        req.woocommercePluginCredential =
          String(
            providedCredential
          )


        return next()

      })
      .catch(error => {

        console.error(
          "WooCommerce plugin authentication error:",
          error.message
        )


        return res.status(500).json({

          success:
            false,

          error:
            "Unable to authenticate WooCommerce plugin"

        })

      })


  } catch (error) {

    console.error(
      "WooCommerce plugin auth error:",
      error.message
    )


    return res.status(500).json({

      success:
        false,

      error:
        "Unable to authenticate WooCommerce plugin"

    })

  }

}


module.exports =
  woocommercePluginAuth