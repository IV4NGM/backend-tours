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
    required: true
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
    required: true
  },
  paid_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'Pending'
  },
  managing_history: [
    {
      type: new mongoose.Schema(
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
          },
          description: {
            type: String,
            required: true
          },
          comments: {
            type: String,
            default: ''
          }
        }, {
          timestamps: true
        }
      )
    }
  ],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Reservation', reservationSchema)
