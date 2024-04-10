const mongoose = require('mongoose')

const clientSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, ingresa tu nombre']
  },
  phone_number: {
    type: String,
    required: [true, 'Por favor, ingresa tu número de teléfono'],
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Client', clientSchema)
