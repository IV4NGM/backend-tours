const mongoose = require('mongoose')

const tourSchema = mongoose.Schema({
  tourTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'TourTemplate'
  },
  starting_date: {
    type: Date,
    required: true
  },
  ending_date: {
    type: Date,
    required: true
  },
  total_seats: {
    type: Number,
    required: true
  },
  confirmed_seats: [Number],
  reserved_seats_amount: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  promos: [
    {
      promo: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Promo'
      },
      available_amount: {
        type: Number,
        required: true
      }
    }
  ],
  status: {
    type: String,
    default: 'Active'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Tour', tourSchema)
