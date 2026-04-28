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
        error: "Authentication required"
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
        error: "Invalid authorization format"
      })
    }

    const token = parts[1]

    /*
    --------------------------------
    VERIFY ACCESS TOKEN ONLY
    --------------------------------
    */
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    /*
    --------------------------------
    ATTACH USER
    --------------------------------
    */
    req.user = {
      id: decoded.id,
      email: decoded.email || null,
      plan: decoded.plan || "free"
    }

    return next()

  } catch (error) {

    /*
    --------------------------------
    TOKEN ERROR HANDLING
    --------------------------------
    */
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired"
      })
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token"
      })
    }

    console.error("Auth middleware error:", error.message)

    return res.status(401).json({
      error: "Authentication failed"
    })

  }

}



module.exports = auth