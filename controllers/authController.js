const Merchant = require("../models/Merchant")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

async function register(req, res) {

  try {

    const { name, email, password } = req.body

    const existing = await Merchant.findOne({ email })

    if (existing) {
      return res.status(400).json({
        error: "Merchant already exists"
      })
    }

    const hashed = await bcrypt.hash(password, 10)

    const merchant = await Merchant.create({
      name,
      email,
      password: hashed
    })

    res.json({
      message: "Merchant registered successfully"
    })

  } catch (error) {

    res.status(500).json({
      error: error.message
    })

  }

}

async function login(req, res) {

  try {

    const { email, password } = req.body

    const merchant = await Merchant.findOne({ email })

    if (!merchant) {
      return res.status(404).json({
        error: "Merchant not found"
      })
    }

    const valid = await bcrypt.compare(password, merchant.password)

    if (!valid) {
      return res.status(401).json({
        error: "Invalid password"
      })
    }

    const token = jwt.sign(
      { id: merchant._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )

    res.json({ token })

  } catch (error) {

    res.status(500).json({
      error: error.message
    })

  }

}

module.exports = {
  register,
  login
}