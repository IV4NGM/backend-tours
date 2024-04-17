const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Reservation = require('@/models/reservationsModel')

const getAllReservations = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }
    const reservations = await Promise.all(tour.reservations.map(reservation => Reservation.findOne({ _id: reservation._id })))
    if (reservations) {
      res.status(200).json(reservations)
    } else {
      res.status(400)
      throw new Error('No se pudieron obtener todas las reservaciones')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron obtener todas las reservaciones')
    }
  }
})

module.exports = getAllReservations
