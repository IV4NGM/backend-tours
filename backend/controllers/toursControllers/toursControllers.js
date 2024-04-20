const { createTour, getTour, getAllTours, updateTour, deleteTour } = require('./crudControllers/toursCrud')
const getAllReservations = require('./toursReservationsControllers/getAllReservations')
const addPromos = require('./promosControllers/addPromos')
const editPromo = require('./promosControllers/editPromo')
const deletePromo = require('./promosControllers/deletePromo')
const cancelTour = require('./toursReservationsControllers/cancelTour')
const setTourCompleted = require('./toursReservationsControllers/setTourCompleted')
const getToursFormatted = require('./toursAndTemplatesControllers/getToursFormatted')

module.exports = {
  createTour,
  getTour,
  getAllTours,
  getAllReservations,
  updateTour,
  addPromos,
  editPromo,
  deletePromo,
  cancelTour,
  setTourCompleted,
  deleteTour,
  getToursFormatted
}
