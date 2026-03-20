const User = require("../models/User")
const Store = require("../models/store")

const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")



/*
--------------------------------
REGISTER USER
--------------------------------
*/

async function register(req, res) {

  try {

    const { name, email, password } = req.body

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "All fields are required"
      })
    }

    /*
    --------------------------------
    CHECK EXISTING USER
    --------------------------------
    */

    const existing = await User.findOne({ email })

    if (existing) {
      return res.status(400).json({
        error: "User already exists"
      })
    }


    /*
    --------------------------------
    HASH PASSWORD
    --------------------------------
    */

    const hashedPassword = await bcrypt.hash(password, 10)


    /*
    --------------------------------
    CREATE USER
    --------------------------------
    */

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      plan: "free"
    })


    /*
    --------------------------------
    AUTO CREATE STORE (CRITICAL FIX)
    --------------------------------
    */

    const store = await Store.create({
      merchant_id: user._id,
      store_name: `${name}'s Store`,
      whatsapp_number: "",
      plan: "free",
      orders_used: 0
    })


    /*
    --------------------------------
    GENERATE TOKEN
    --------------------------------
    */

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        plan: user.plan
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
      store
    })

  } catch (error) {

    console.error("Register error:", error)

    res.status(500).json({
      error: "Registration failed"
    })

  }

}



/*
--------------------------------
LOGIN USER
--------------------------------
*/

async function login(req, res) {

  try {

    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      })
    }


    /*
    --------------------------------
    FIND USER
    --------------------------------
    */

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      })
    }


    /*
    --------------------------------
    VERIFY PASSWORD
    --------------------------------
    */

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid password"
      })
    }


    /*
    --------------------------------
    GET DEFAULT STORE
    --------------------------------
    */

    const store = await Store.findOne({
      merchant_id: user._id
    }).sort({ createdAt: 1 })


    if (!store) {
      return res.status(404).json({
        error: "Store not found"
      })
    }


    /*
    --------------------------------
    GENERATE TOKEN
    --------------------------------
    */

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        plan: user.plan
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    )


    /*
    --------------------------------
    RESPONSE
    --------------------------------
    */

    res.status(200).json({
      token,
      user,
      store
    })

  } catch (error) {

    console.error("Login error:", error)

    res.status(500).json({
      error: "Login failed"
    })

  }

}



module.exports = {
  register,
  login
}