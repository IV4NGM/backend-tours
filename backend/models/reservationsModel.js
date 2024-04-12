const mongoose = require('mongoose')

const reservationSchema = mongoose.Schema({
  tour: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Tour'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Client'
  },
  reserved_seats_amount: {
    type: Number,
    required: [true, 'Por favor, ingresa la cantidad de asientos reservados']
  },
  confirmed_seats: [Number],
  promo_applied: {
    promo: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Promo'
    },
    amount: {
      type: Number,
      required: true
    }
  },
  total_price: {
    type: Number,
    required: [true, 'Por favor, ingresa el precio total por pagar']
  },
  amount_paid: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'Pending'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Reservation', reservationSchema)
