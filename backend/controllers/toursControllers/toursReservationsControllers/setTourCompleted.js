const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Reservation = require('@/models/reservationsModel')

const setTourCompletedSession = async (req, res, tour, reservations) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const statusesToKeepArray = ['Canceled by client', 'Tour canceled', 'Canceled', 'Completed']

    let updatedReservations = 0
    let reservationsWithDevolutions = 0

    const reservationsUpdatedResults = await Promise.all(reservations.map(async (reservation) => {
      if (statusesToKeepArray.includes(reservation.status.status_code)) {
        return true
      }
      try {
        let status = { ...reservation.status }

        if (reservation.pending_devolution > 0) {
          reservationsWithDevolutions += 1
          status = {
            status_code: 'Pending devolution',
            description: 'Tour completado. Devolución pendiente.',
            next_status: {
              status_code: 'Completed',
              description: 'Reservación completada por tour completado'
            }
          }
        } else {
          status = {
            status_code: 'Completed',
            description: 'Reservación completada por tour completado'
          }
        }

        const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
          status,
          $push: {
            history: {
              user: req.user,
              action_type: 'Reservación completada por tour completado',
              description: 'Reservación completada por tour completado'
            }
          }
        }, { new: true, session })

        updatedReservations += 1

        if (!updatedReservation) {
          throw new Error('No se pudo marcar el tour como completo. Problema con las reservaciones')
        }
        return true
      } catch (error) {
        return false
      }
    }))

    const allReservationsUpdated = reservationsUpdatedResults.every(result => result === true)
    if (!allReservationsUpdated) {
      res.status(400)
      throw new Error('No se pudo marcar el tour como completo. Problema con las reservaciones')
    }

    const newTour = await Tour.findOneAndUpdate({ _id: tour._id }, {
      isActive: false,
      status: {
        status_code: 'Completed',
        description: 'Tour completo'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Tour completo',
          description: 'Tour completo'
        }
      }
    }, {
      new: true,
      session
    })

    if (!newTour) {
      res.status(400)
      throw new Error('No se pudo marcar el tour como completo')
    }

    await session.commitTransaction()
    session.endSession()
    res.status(200).send({
      _id: tour._id,
      updated_reservations: updatedReservations,
      reservations_with_devolutions: reservationsWithDevolutions
    })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    console.error(error)
    throw new Error(error?.message || 'No se pudo marcar el tour como completo')
  }
}

const setTourCompleted = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }
    if (tour?.status?.status_code === 'Completed') {
      res.status(400)
      throw new Error('El tour ya está completo')
    }
    const reservations = await Promise.all(tour.reservations.map(reservation => Reservation.findOne({ _id: reservation._id })))
    if (!reservations) {
      res.status(400)
      throw new Error('No se pudieron obtener todas las reservaciones')
    }
    await setTourCompletedSession(req, res, tour, reservations)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo marcar el tour como completo')
    }
  }
})

module.exports = setTourCompleted
