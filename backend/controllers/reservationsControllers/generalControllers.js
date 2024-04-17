const createReservation = require('./generalControllers/createReservation')
const makeDeposit = require('./generalControllers/makeDeposit')
const chooseSeats = require('./generalControllers/chooseSeats')
const makeDevolution = require('./generalControllers/makeDevolution')
const changeConfirmedSeats = require('./generalControllers/changeConfirmedSeats')
const reduceReservedSeatsAmount = require('./generalControllers/reduceReservedSeatsAmount')
const reduceConfirmedSeats = require('./generalControllers/reduceConfirmedSeats')
const cancelReservationByClient = require('./generalControllers/cancelReservationByClient')

module.exports = {
  createReservation,
  makeDeposit,
  chooseSeats,
  makeDevolution,
  changeConfirmedSeats,
  reduceReservedSeatsAmount,
  reduceConfirmedSeats,
  cancelReservationByClient
}
