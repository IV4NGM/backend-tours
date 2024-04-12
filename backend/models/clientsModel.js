const mongoose = require('mongoose')

const clientSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, ingresa el nombre del cliente']
  },
  phone_number: {
    type: String,
    required: [true, 'Por favor, ingresa el número de teléfono del cliente'],
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
