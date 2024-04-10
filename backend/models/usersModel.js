const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, ingresa tu nombre']
  },
  email: {
    type: String,
    required: [true, 'Por favor, ingresa tu email'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Por favor, ingresa tu contraseña']
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isManager: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('User', userSchema)
