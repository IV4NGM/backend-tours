const mongoose = require('mongoose')

const transactionDescriptionSchema = mongoose.Schema({
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Reservation'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  transaction_type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number
  },
  comments: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('TransactionDescription', transactionDescriptionSchema)
