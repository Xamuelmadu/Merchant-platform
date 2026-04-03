const jwt = require("jsonwebtoken")

function auth(req, res, next) {

  try {

    const header = req.headers.authorization

    /*
    --------------------------------
    NO TOKEN
    --------------------------------
    */
    if (!header) {
      return res.status(401).json({
        error: "No token provided"
      })
    }

    /*
    --------------------------------
    FORMAT CHECK
    --------------------------------
    */
    const parts = header.split(" ")

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        error: "Invalid token format"
      })
    }

    const token = parts[1]

    /*
    --------------------------------
    VERIFY TOKEN
    --------------------------------
    */
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing in environment")
      return res.status(500).json({
        error: "Server misconfiguration"
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    /*
    --------------------------------
    ATTACH USER (SAFE DEFAULTS)
    --------------------------------
    */
    req.user = {
      id: decoded.id,
      email: decoded.email || null,
      plan: decoded.plan || "free" // fallback for OAuth users
    }

    return next()

  } catch (error) {

    console.error("Auth error:", error.message)

    return res.status(401).json({
      error: "Invalid or expired token"
    })

  }

}

module.exports = auth