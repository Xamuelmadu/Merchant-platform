const express = require("express")
const router = express.Router()

const passport = require("passport")

const {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  googleCallback
} = require("../controllers/authController")

/*
--------------------------------
OTP AUTH (PRIMARY ENTRY)
--------------------------------
*/

router.post("/send-otp", sendOtp)
router.post("/verify-otp", verifyOtp)

/*
--------------------------------
TOKEN MANAGEMENT
--------------------------------
*/

/*
Refresh access token
*/
router.get("/refresh", refreshToken)

/*
Logout (clear cookie)
*/
router.post("/logout", logout)

/*
--------------------------------
GOOGLE OAUTH
--------------------------------
*/

/*
Redirect to Google
*/
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
)

/*
Google callback
*/
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login`
  }),
  googleCallback
)

module.exports = router