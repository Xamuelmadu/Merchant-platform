const User = require("../models/user")
const Store = require("../models/store")
const Otp = require("../models/otp")
const Session = require("../models/session")

const bcrypt = require("bcryptjs")
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
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  )
}



/*
--------------------------------
SESSION HELPERS
--------------------------------
*/

async function createSessionAndRespond(req, res, user, store) {

  const userAgent = req.headers["user-agent"]
  const ip = req.ip

  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  await Session.create({
    user_id: user._id,
    refresh_token: refreshToken,
    user_agent: userAgent,
    ip_address: ip,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000
  })

  return res.json({
    token: accessToken,
    user,
    store_id: store ? store._id : null
  })

}



async function createSessionOnly(req, res, user) {

  const userAgent = req.headers["user-agent"]
  const ip = req.ip

  const refreshToken = generateRefreshToken(user)

  await Session.create({
    user_id: user._id,
    refresh_token: refreshToken,
    user_agent: userAgent,
    ip_address: ip,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax"
  })

}



/*
--------------------------------
REGISTER
--------------------------------
*/

async function register(req, res) {

  try {

    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const existing = await User.findOne({ email })

    if (existing) {
      return res.status(400).json({ error: "User already exists" })
    }

    const hashed = await bcrypt.hash(password, 10)

    await User.create({
      name,
      email,
      password: hashed,
      plan: "free"
    })

    return res.json({
      message: "User registered successfully"
    })

  } catch (error) {

    console.error("Register error:", error.message)

    return res.status(500).json({
      error: "Registration failed"
    })

  }

}



/*
--------------------------------
LOGIN
--------------------------------
*/

async function login(req, res) {

  try {

    const { email, password } = req.body

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(401).json({ error: "Invalid password" })
    }

    const store = await Store.findOne({
      merchant_id: user._id
    }).sort({ createdAt: 1 })

    return createSessionAndRespond(req, res, user, store)

  } catch (error) {

    console.error("Login error:", error.message)

    return res.status(500).json({ error: "Login failed" })

  }

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
VERIFY OTP
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

    return createSessionAndRespond(req, res, user, store)

  } catch (error) {

    return res.status(500).json({
      error: "OTP verification failed"
    })

  }

}



/*
--------------------------------
REFRESH TOKEN
--------------------------------
*/

async function refreshToken(req, res) {

  try {

    const token = req.cookies.refresh_token

    if (!token) {
      return res.status(401).json({ error: "No refresh token" })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const session = await Session.findOne({
      user_id: decoded.id,
      refresh_token: token
    })

    if (!session) {
      return res.status(401).json({ error: "Session invalid" })
    }

    const user = await User.findById(decoded.id)

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

  try {

    const token = req.cookies.refresh_token

    if (token) {
      await Session.deleteOne({ refresh_token: token })
    }

    res.clearCookie("refresh_token")

    return res.json({ message: "Logged out" })

  } catch (error) {

    return res.status(500).json({
      error: "Logout failed"
    })

  }

}

async function logoutAll(req, res) {

  await Session.deleteMany({
    user_id: req.user.id
  })

  res.clearCookie("refresh_token")

  res.json({ message: "All sessions cleared" })
}

/*
--------------------------------
SESSIONS
--------------------------------
*/

async function getSessions(req, res) {

  const sessions = await Session.find({
    user_id: req.user.id
  }).sort({ createdAt: -1 })

  res.json(sessions)

}



async function revokeSession(req, res) {

  const { session_id } = req.body

  await Session.deleteOne({
    _id: session_id,
    user_id: req.user.id
  })

  res.json({ message: "Session revoked" })

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

    await createSessionOnly(req, res, user)

    const accessToken = generateAccessToken(user)

    return res.redirect(
      `${process.env.FRONTEND_URL}/auth-success?store_id=${store?._id || ""}&token=${accessToken}`
    )

  } catch (error) {

    return res.redirect(`${process.env.FRONTEND_URL}/login`)
  }

}



module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  getSessions,
  revokeSession,
  googleCallback
}