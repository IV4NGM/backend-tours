const mongoose = require('mongoose')

const historySchema = require('./historySchema')

const promoSchema = mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Por favor, ingresa el tipo de promoción'],
    enum: ['2x1', 'discount', 'percentageDiscount']
  },
  value: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    default: 5
  },
  maxUsesPerReservation: {
    type: Number,
    default: 1
  },
  usedCount: {
    type: Number,
    default: 0
  },
  show: {
    type: Boolean,
    default: true
  },
  code: {
    type: String,
    required: [true, 'Por favor, ingresa el código de la promoción']
  },
  isActive: {
    type: Boolean,
    default: true
  }
})

const tourSchema = mongoose.Schema({
  tourTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'TourTemplate'
  },
  starting_date: {
    type: Date,
    required: [true, 'Por favor, ingresa la fecha de inicio']
  },
  additional_images: [String],
  total_seats: {
    type: Number,
    required: [true, 'Por favor, ingresa el número total de asientos']
  },
  confirmed_seats: [Number],
  reserved_seats_amount: {
    type: Number,
    default: 0
  },
  reservations: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Reservation'
  }],
  price: {
    type: Number,
    required: [true, 'Por favor, ingresa el precio']
  },
  min_payment: {
    type: Number,
    required: [true, 'Por favor, ingresa el precio para reservar']
  },
  promos: [promoSchema],
  status: {
    status_code: {
      type: String,
      default: 'Active'
    },
    description: {
      type: String,
      default: ''
    }
  },
  history: [historySchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Tour', tourSchema)
