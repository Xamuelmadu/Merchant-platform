require("dotenv").config()

const express = require("express")
const cors = require("cors")
const cron = require("node-cron")
const passport = require("passport")
const cookieParser = require("cookie-parser")

const connectDB = require("./config/database")

/*
================================
CREATE APP
================================
*/

const app = express()


/*
================================
COOKIE / PASSPORT
================================
*/

app.use(cookieParser())

app.use(passport.initialize())

require("./config/passport")


/*
================================
ROUTES
================================
*/

const authRoutes =
  require("./routes/authRoutes")

const storeRoutes =
  require("./routes/storeRoutes")

const productRoutes =
  require("./routes/productRoutes")

const orderRoutes =
  require("./routes/orderRoutes")

const paymentRoutes =
  require("./routes/paymentRoutes")

const engineRoutes =
  require("./routes/engineRoutes")

const analyticsRoutes =
  require("./routes/analyticsRoutes")

const billingRoutes =
  require("./routes/billingRoutes")

const webhookRoutes =
  require("./routes/webhookRoutes")

const integrationRoutes =
  require("./routes/integrationRoutes")

const conversationRoutes =
  require("./routes/conversationRoutes")


/*
================================
SERVICES
================================
*/

const {
  runMonthlyBilling
} =
  require("./services/billingEngine")

const {
  checkSubscriptions
} =
  require("./cron/subscriptionCron")


/*
================================
CORS CONFIGURATION
================================

Guava frontend:

https://www.guavabyinvite.com

The API uses HTTP-only refresh cookies,
therefore credentials must be enabled.

================================
*/

const allowedOrigins = [

  "https://www.guavabyinvite.com",

  "https://guavabyinvite.com",

  process.env.FRONTEND_URL,

  "http://localhost:3000"

].filter(Boolean)


app.use(

  cors({

    origin: function (
      origin,
      callback
    ) {

      /*
      --------------------------------
      SERVER-TO-SERVER REQUESTS
      --------------------------------

      Requests without an Origin header
      are allowed.

      This is required for trusted backend
      integrations such as Shopify,
      WooCommerce and internal services.
      --------------------------------
      */

      if (!origin) {

        return callback(
          null,
          true
        )

      }


      /*
      --------------------------------
      ALLOWED FRONTENDS
      --------------------------------
      */

      if (
        allowedOrigins.includes(
          origin
        )
      ) {

        return callback(
          null,
          true
        )

      }


      /*
      --------------------------------
      BLOCK UNKNOWN ORIGINS
      --------------------------------
      */

      console.error(
        "CORS blocked origin:",
        origin
      )

      return callback(
        new Error(
          "Not allowed by CORS"
        )
      )

    },


    /*
    --------------------------------
    CREDENTIALS
    --------------------------------
    */

    credentials: true,


    /*
    --------------------------------
    METHODS
    --------------------------------
    */

    methods: [

      "GET",

      "POST",

      "PUT",

      "PATCH",

      "DELETE",

      "OPTIONS"

    ],


    /*
    --------------------------------
    HEADERS
    --------------------------------
    */

    allowedHeaders: [

      "Content-Type",

      "Authorization",

      "X-Store-Id",

      "x-store-id",

      "X-Platform-Key",

      "x-platform-key",

      "X-Shopify-Integration-Secret",

      "x-shopify-integration-secret"

    ]

  })

)


/*
================================
STRIPE WEBHOOK RAW BODY
================================

Stripe signatures must be calculated
against the original request body.

================================
*/

app.use(

  "/webhooks/stripe",

  express.raw({

    type:
      "application/json"

  })

)


/*
================================
SHOPIFY WEBHOOK RAW BODY
================================

Shopify webhook signatures must be
calculated against the original body.

================================
*/

app.use(

  "/webhooks/shopify",

  express.raw({

    type:
      "application/json"

  })

)


/*
================================
WOOCOMMERCE WEBHOOK RAW BODY
================================

WooCommerce webhook signatures must be
calculated against the original body.

================================
*/

app.use(

  "/webhooks/woocommerce",

  express.raw({

    type:
      "application/json"

  })

)


/*
================================
BODY PARSER
================================
*/

app.use(

  express.json({

    limit:
      "10mb"

  })

)


/*
================================
URL ENCODED BODY
================================
*/

app.use(

  express.urlencoded({

    extended: true,

    limit:
      "10mb"

  })

)


/*
================================
HEALTH CHECK
================================
*/

app.get(

  "/",

  (req, res) => {

    return res.json({

      success: true,

      message:
        "Guava AI Commerce Platform API",

      status:
        "online"

    })

  }

)


/*
================================
API HEALTH CHECK
================================
*/

app.get(

  "/api/health",

  (req, res) => {

    return res.json({

      success: true,

      service:
        "Guava AI Commerce Platform",

      status:
        "healthy",

      timestamp:
        new Date().toISOString()

    })

  }

)


/*
================================
AUTH ROUTES
================================
*/

app.use(

  "/api/auth",

  authRoutes

)


/*
================================
STORE ROUTES
================================
*/

app.use(

  "/api/store",

  storeRoutes

)


/*
================================
PRODUCT ROUTES
================================
*/

app.use(

  "/api/products",

  productRoutes

)


/*
================================
ORDER ROUTES
================================
*/

app.use(

  "/api/orders",

  orderRoutes

)


/*
================================
PAYMENT ROUTES
================================
*/

app.use(

  "/api/payments",

  paymentRoutes

)


/*
================================
ENGINE ROUTES
================================
*/

app.use(

  "/api/engine",

  engineRoutes

)


/*
================================
ANALYTICS ROUTES
================================
*/

app.use(

  "/api/analytics",

  analyticsRoutes

)


/*
================================
BILLING ROUTES
================================
*/

app.use(

  "/api/billing",

  billingRoutes

)


/*
================================
WEBHOOK ROUTES
================================
*/

app.use(

  "/api/webhooks",

  webhookRoutes

)


/*
================================
INTEGRATION ROUTES
================================
*/

app.use(

  "/api/integrations",

  integrationRoutes

)


/*
================================
CONVERSATION ROUTES
================================
*/

app.use(

  "/api/conversation",

  conversationRoutes

)


/*
================================
404 HANDLER
================================
*/

app.use(

  (req, res) => {

    return res.status(404).json({

      success: false,

      error:
        "Route not found",

      path:
        req.originalUrl

    })

  }

)


/*
================================
GLOBAL ERROR HANDLER
================================
*/

app.use(

  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "Global server error:",
      error
    )


    /*
    --------------------------------
    CORS ERROR
    --------------------------------
    */

    if (
      error.message ===
      "Not allowed by CORS"
    ) {

      return res.status(403).json({

        success: false,

        error:
          "Origin not allowed"

      })

    }


    /*
    --------------------------------
    STANDARD ERROR
    --------------------------------
    */

    return res.status(
      error.status || 500
    ).json({

      success: false,

      error:
        process.env.NODE_ENV ===
        "production"

          ? "Internal server error"

          : error.message

    })

  }

)


/*
================================
DATABASE + SERVER
================================
*/

const PORT =
  process.env.PORT ||
  5000


async function startServer() {

  try {

    /*
    --------------------------------
    CONNECT DATABASE
    --------------------------------
    */

    await connectDB()


    console.log(
      "✅ Database connected"
    )


    /*
    --------------------------------
    START SERVER
    --------------------------------
    */

    app.listen(

      PORT,

      () => {

        console.log(
          `🚀 Guava AI Commerce API running on port ${PORT}`
        )

        console.log(
          "🌐 Allowed frontend origins:",
          allowedOrigins
        )

      }

    )


  } catch (error) {

    console.error(
      "❌ Failed to start server:",
      error
    )

    process.exit(1)

  }

}


/*
================================
MONTHLY BILLING
================================

Runs at midnight on the first day
of every month.

================================
*/

cron.schedule(

  "0 0 1 * *",

  async () => {

    try {

      console.log(
        "💳 Running monthly billing..."
      )

      await runMonthlyBilling()

      console.log(
        "✅ Monthly billing completed"
      )

    } catch (error) {

      console.error(
        "❌ Monthly billing failed:",
        error
      )

    }

  }

)


/*
================================
SUBSCRIPTION CHECK
================================

Runs every hour.

================================
*/

cron.schedule(

  "0 * * * *",

  async () => {

    try {

      console.log(
        "🔄 Checking subscriptions..."
      )

      await checkSubscriptions()

      console.log(
        "✅ Subscription check completed"
      )

    } catch (error) {

      console.error(
        "❌ Subscription check failed:",
        error
      )

    }

  }

)


/*
================================
START
================================
*/

startServer()