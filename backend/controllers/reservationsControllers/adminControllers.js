const addDiscount = require('./adminControllers/addDiscount')
const reducePendingDevolution = require('./adminControllers/reducePendingDevolution')
const reduceAmountPaid = require('./adminControllers/reduceAmountPaid')
const cancelReservationWithoutDevolutions = require('./adminControllers/cancelWithoutDevolutions')
const cancelReservationWithDevolutions = require('./adminControllers/cancelWithDevolutions')

module.exports = {
  addDiscount,
  reducePendingDevolution,
  reduceAmountPaid,
  cancelReservationWithoutDevolutions,
  cancelReservationWithDevolutions
}
