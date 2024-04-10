const mongoose = require('mongoose')

const promoSchema = mongoose.Schema({
  promo_code: {
    type: String,
    required: true,
    unique: true
  },
  discount: {
    type: Number
  },
  promo_name: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Promo', promoSchema)
