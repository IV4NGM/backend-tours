const mongoose = require('mongoose')

const historySchema = require('./historySchema')

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
    type: {
      type: String,
      enum: ['2x1', 'discount', 'percentageDiscount']
    },
    value: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number
    },
    code: {
      type: String
    }
  },
  price_to_reserve: {
    type: Number,
    required: true
  },
  price_without_discounts: {
    type: Number,
    required: true
  },
  total_price: {
    type: Number,
    required: true
  },
  price_to_pay: {
    type: Number,
    required: true
  },
  amount_paid: {
    type: Number,
    default: 0
  },
  status: {
    status_code: {
      type: String,
      default: 'Pending'
    },
    description: {
      type: String,
      default: 'Pago mínimo para reservar pendiente.'
    },
    next_status: {
      status_code: String,
      description: String
    }
  },
  pending_devolution: {
    type: Number,
    default: 0
  },
  history: [historySchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Reservation', reservationSchema)
