const jwt = require("jsonwebtoken")

function auth(req, res, next) {

  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({
      error: "No token provided"
    })
  }

  const parts = header.split(" ")

  if (parts.length !== 2) {
    return res.status(401).json({
      error: "Token format invalid"
    })
  }

  const token = parts[1]

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
  id: decoded.id
}

    next()

  } catch (error) {

    console.log("JWT ERROR:", error.message)

    return res.status(401).json({
      error: "Invalid token"
    })

  }

}

module.exports = auth