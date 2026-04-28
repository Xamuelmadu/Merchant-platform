const User = require("../models/user")
const Store = require("../models/store")
const Otp = require("../models/otp")

const jwt = require("jsonwebtoken")
const crypto = require("crypto")

const { sendOtpEmail } = require("../services/mailService")

/*
--------------------------------
TOKEN HELPERS
--------------------------------
*/

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
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
CREATE SESSION (SIMPLIFIED)
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
SEND OTP
--------------------------------
*/

async function sendOtp(req, res) {

  try {

    const { email } = req.body

    const otp = crypto.randomInt(100000, 999999).toString()

    await Otp.deleteMany({ email })

    await Otp.create({
      email,
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000)
    })

    await sendOtpEmail(email, otp)

    return res.json({ message: "OTP sent" })

  } catch (error) {

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

    const { email, otp } = req.body

    const record = await Otp.findOne({ email })

    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" })
    }

    if (record.expires_at < new Date()) {
      return res.status(400).json({ error: "OTP expired" })
    }

    let user = await User.findOne({ email })

    if (!user) {
      user = await User.create({
        email,
        name: email.split("@")[0],
        plan: "free"
      })
    }

    const store = await Store.findOne({
      merchant_id: user._id
    })

    await Otp.deleteMany({ email })

    return createSessionAndRespond(res, user, store)

  } catch (error) {

    return res.status(500).json({
      error: "OTP verification failed"
    })

  }
}

/*
--------------------------------
REFRESH TOKEN (NO DB CHECK)
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
LOGOUT
--------------------------------
*/

async function logout(req, res) {

  res.clearCookie("refresh_token")

  return res.json({ message: "Logged out" })
}

/*
--------------------------------
GOOGLE CALLBACK
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

    return res.redirect(`${process.env.FRONTEND_URL}/login`)
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  googleCallback
}