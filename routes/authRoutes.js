const express = require("express")
const router = express.Router()

const passport = require("passport")
const jwt = require("jsonwebtoken")

const User = require("../models/user")

const {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  googleCallback,
  generateAccessToken
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
Get current authenticated session
Used after Google OAuth redirect
*/
router.get("/session", async (req, res) => {

  try {

    const refreshTokenCookie = req.cookies.refresh_token

    if (!refreshTokenCookie) {
      return res.status(401).json({
        error: "No session"
      })
    }

    const decoded = jwt.verify(
      refreshTokenCookie,
      process.env.JWT_REFRESH_SECRET
    )

    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({
        error: "User not found"
      })
    }

    const accessToken = generateAccessToken(user)

    return res.json({
      token: accessToken,
      user
    })

  } catch (error) {

    console.error("Session error:", error)

    return res.status(401).json({
      error: "Invalid session"
    })

  }

})

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