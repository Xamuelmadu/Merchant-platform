const express = require("express")
const router = express.Router()

const passport = require("passport")

const auth = require("../middleware/auth")

const {
  register,
  login,
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  getSessions,
  revokeSession,
  googleCallback
} = require("../controllers/authController")



/*
--------------------------------
EMAIL AUTH
--------------------------------
*/

router.post("/register", register)
router.post("/login", login)



/*
--------------------------------
OTP AUTH
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
Logout current session
*/
router.post("/logout", logout)



/*
--------------------------------
SESSION MANAGEMENT (DEVICES)
--------------------------------
*/

/*
Get all active sessions/devices
*/
router.get("/sessions", auth, getSessions)

/*
Revoke specific session/device
*/
router.post("/revoke-session", auth, revokeSession)
router.post("/logout-all", auth, logoutAll)



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