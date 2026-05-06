const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy

const User = require("../models/user")

passport.use(new GoogleStrategy({

  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`

}, async (accessToken, refreshToken, profile, done) => {

  try{

    let user = await User.findOne({
      email: profile.emails[0].value
    })

    if(!user){

      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        plan: "free"
      })

    }

    return done(null, user)

  }catch(err){

    return done(err, null)

  }

}))