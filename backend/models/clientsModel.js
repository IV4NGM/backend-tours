const mongoose = require('mongoose')

const historySchema = require('./historySchema')

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
  email: {
    type: String,
    default: ''
  },
  reputation: {
    type: Number,
    default: 10
  },
  reservations: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Reservation'
  }],
  history: [historySchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Client', clientSchema)
