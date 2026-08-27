const passport = require("passport")
const GoogleStrategy =
  require("passport-google-oauth20").Strategy

const User = require("../models/user")

const clientID =
  process.env.GOOGLE_CLIENT_ID

const clientSecret =
  process.env.GOOGLE_CLIENT_SECRET

const backendURL =
  process.env.BACKEND_URL


/*
--------------------------------
GOOGLE OAUTH
--------------------------------
Only enable Google OAuth when
credentials are configured.
--------------------------------
*/

if (clientID && clientSecret && backendURL) {

  passport.use(
    new GoogleStrategy(

      {
        clientID,

        clientSecret,

        callbackURL:
          `${backendURL}/api/auth/google/callback`
      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {

        try {

          const email =
            profile.emails?.[0]?.value

          if (!email) {

            return done(
              new Error(
                "Google account has no email"
              )
            )

          }

          let user =
            await User.findOne({
              email
            })

          if (!user) {

            user =
              await User.create({

                name:
                  profile.displayName,

                email,

                plan: "free"

              })

          }

          return done(null, user)

        } catch (error) {

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

} else {

  console.log(
    "ℹ️ Google OAuth disabled: credentials not configured"
  )

}


module.exports = passport