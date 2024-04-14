const mongoose = require('mongoose')

const historySchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  action_type: {
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
  user_comments: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

module.exports = historySchema
