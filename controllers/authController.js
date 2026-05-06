const User = require("../models/user")
const Store = require("../models/store")
const Otp = require("../models/otp")

const jwt = require("jsonwebtoken")
const crypto = require("crypto")

// 🔁 CHANGED: WhatsApp OTP instead of email
const { sendWhatsAppOTP } = require("../services/whatsappOtpService")

/*
--------------------------------
TOKEN HELPERS
--------------------------------
*/

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      phone: user.phone, // 🔁 changed
      plan: user.plan || "free"
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  )
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  )
}

/*
--------------------------------
CREATE SESSION (UNCHANGED)
--------------------------------
*/

function createSessionAndRespond(res, user, store) {

  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000
  })

  return res.json({
    token: accessToken,
    user,
    store_id: store ? store._id : null
  })
}

/*
--------------------------------
SEND OTP (WHATSAPP)
--------------------------------
*/

async function sendOtp(req, res) {

  try {

    const { phone } = req.body

    if (!phone || !phone.startsWith("+")) {
      return res.status(400).json({
        error: "Invalid phone format (use +234...)"
      })
    }

    const otp = crypto.randomInt(100000, 999999).toString()

    // 🔁 changed email → phone
    await Otp.deleteMany({ phone })

    await Otp.create({
      phone,
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000)
    })

    await sendWhatsAppOTP(phone, otp)

    return res.json({ message: "OTP sent via WhatsApp" })

  } catch (error) {

    console.error("Send OTP error:", error)

    return res.status(500).json({
      error: "Failed to send OTP"
    })

  }
}

/*
--------------------------------
VERIFY OTP (LOGIN ENTRY POINT)
--------------------------------
*/

async function verifyOtp(req, res) {

  try {

    const { phone, otp } = req.body

    const record = await Otp.findOne({ phone })

    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" })
    }

    if (record.expires_at < new Date()) {
      return res.status(400).json({ error: "OTP expired" })
    }

    let user = await User.findOne({ phone })

    if (!user) {
      user = await User.create({
        phone,
        name: phone,
        plan: "free"
      })
    }

    // 🔥 IMPORTANT: KEEP THIS (we still return store if exists)
    const store = await Store.findOne({
      merchant_id: user._id
    })

    await Otp.deleteMany({ phone })

    return createSessionAndRespond(res, user, store)

  } catch (error) {

    console.error("Verify OTP error:", error)

    return res.status(500).json({
      error: "OTP verification failed"
    })

  }
}

/*
--------------------------------
REFRESH TOKEN (UNCHANGED)
--------------------------------
*/

async function refreshToken(req, res) {

  try {

    const token = req.cookies.refresh_token

    if (!token) {
      return res.status(401).json({ error: "No refresh token" })
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

    const user = await User.findById(decoded.id)

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    const accessToken = generateAccessToken(user)

    return res.json({ token: accessToken })

  } catch (error) {

    return res.status(401).json({
      error: "Invalid refresh token"
    })

  }
}

/*
--------------------------------
LOGOUT (UNCHANGED)
--------------------------------
*/

async function logout(req, res) {

  res.clearCookie("refresh_token")

  return res.json({ message: "Logged out" })
}

/*
--------------------------------
GOOGLE CALLBACK (MINOR ALIGNMENT)
--------------------------------
*/

async function googleCallback(req, res) {

  try {

    const user = req.user

    const store = await Store.findOne({
      merchant_id: user._id
    })

    const refreshToken = generateRefreshToken(user)

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    })

    const accessToken = generateAccessToken(user)

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth-success?store_id=${store?._id || ""}&token=${accessToken}`
    )

  } catch (error) {

    console.error("GOOGLE CALLBACK ERROR:", error)

    return res.redirect(`${process.env.FRONTEND_URL}/login`)
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  googleCallback
  generateAccessToken
}