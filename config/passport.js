const passport = require("passport")
const GoogleStrategy =
  require("passport-google-oauth20").Strategy

const User = require("../models/user")


/*
================================
GOOGLE OAUTH CONFIGURATION
================================
*/

const clientID =
  process.env.GOOGLE_CLIENT_ID

const clientSecret =
  process.env.GOOGLE_CLIENT_SECRET

const backendURL =
  process.env.BACKEND_URL

const callbackURL =
  process.env.GOOGLE_CALLBACK_URL ||
  (
    backendURL
      ? `${backendURL}/api/auth/google/callback`
      : null
  )


/*
================================
VALIDATE GOOGLE CONFIGURATION
================================
*/

if (
  !clientID ||
  !clientSecret ||
  !callbackURL
) {

  console.error(
    "❌ Google OAuth is not configured."
  )

  if (!clientID) {
    console.error(
      "Missing GOOGLE_CLIENT_ID"
    )
  }

  if (!clientSecret) {
    console.error(
      "Missing GOOGLE_CLIENT_SECRET"
    )
  }

  if (!callbackURL) {
    console.error(
      "Missing GOOGLE_CALLBACK_URL or BACKEND_URL"
    )
  }

} else {

  /*
  --------------------------------
  GOOGLE STRATEGY
  --------------------------------
  */

  passport.use(
    new GoogleStrategy(

      {
        clientID,

        clientSecret,

        callbackURL

      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {

        try {

          /*
          --------------------------------
          GET GOOGLE EMAIL
          --------------------------------
          */

          const email =
            profile.emails?.[0]?.value
              ?.trim()
              .toLowerCase()


          if (!email) {

            return done(
              new Error(
                "Google account has no email"
              )
            )

          }


          /*
          --------------------------------
          FIND EXISTING USER
          --------------------------------
          */

          let user =
            await User.findOne({
              email
            })


          /*
          --------------------------------
          CREATE USER
          --------------------------------
          */

          if (!user) {

            user =
              await User.create({

                name:
                  profile.displayName ||
                  "Google User",

                email,

                plan:
                  "free"

              })

          }


          /*
          --------------------------------
          GOOGLE LOGIN SUCCESS
          --------------------------------
          */

          return done(
            null,
            user
          )

        } catch (error) {

          console.error(
            "Google OAuth user error:",
            error
          )

          return done(
            error,
            null
          )

        }

      }

    )
  )


  console.log(
    "✅ Google OAuth enabled"
  )

  console.log(
    `Google callback URL: ${callbackURL}`
  )

}


/*
================================
EXPORT
================================
*/

module.exports = passport