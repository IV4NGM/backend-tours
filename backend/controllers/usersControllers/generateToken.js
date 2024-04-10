const jwt = require('jsonwebtoken')

const generateToken = (userId, tokenVersion) => {
  return jwt.sign({ user_id: userId, token_version: tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  })
}

module.exports = generateToken
