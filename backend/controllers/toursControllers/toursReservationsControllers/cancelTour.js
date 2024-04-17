const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const cancelReservationsByTourCanceledSession = async (req, res, tour, reservations) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const canceledStatusesArray = ['Canceled by client', 'Tour canceled', 'Canceled']

    let updatedReservations = 0
    let reservationsWithDevolutions = 0

    const reservationsUpdatedResults = await Promise.all(reservations.map(async (reservation) => {
      if (canceledStatusesArray.includes(reservation.status.status_code)) {
        return true
      }
      try {
        const client = await Client.findOne({ _id: reservation.client._id })

        if (!client || !client.isActive) {
          res.status(400)
          throw new Error('No se encontraron datos de clientes')
        }

        const devolutions = reservation.amount_paid
        let status = { ...reservation.status }

        if (devolutions > 0) {
          reservationsWithDevolutions += 1
          status = {
            status_code: 'Pending devolution',
            description: 'Reservación cancelada por tour cancelado. Devolución pendiente.',
            next_status: {
              status_code: 'Tour canceled',
              description: 'Reservación cancelada por tour cancelado'
            }
          }
        } else {
          status = {
            status_code: 'Tour canceled',
            description: 'Reservación cancelada por tour cancelado'
          }
        }

        const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
          status,
          pending_devolution: devolutions,
          $push: {
            history: {
              user: req.user,
              action_type: 'Reservación cancelada por tour cancelado',
              description: 'Reservación cancelada por tour cancelado'
            }
          }
        }, { new: true, session })

        const clientUpdated = await Client.findOneAndUpdate({ _id: client._id }, {
          $push: {
            reservations: reservation,
            history: {
              user: req.user,
              action_type: 'Reservación cancelada por tour cancelado',
              description: 'Reservación: ' + reservation._id
            }
          }
        },
        { new: true, session })

        updatedReservations += 1

        if (!updatedReservation || !clientUpdated) {
          throw new Error('No se pudo cancelar el tour. Problema con las reservaciones')
        }
        return true
      } catch (error) {
        return false
      }
    }))

    const allReservationsUpdated = reservationsUpdatedResults.every(result => result === true)
    if (!allReservationsUpdated) {
      res.status(400)
      throw new Error('No se pudo cancelar el tour. Problema con las reservaciones')
    }

    const newTour = await Tour.findOneAndUpdate({ _id: tour._id }, {
      isActive: false,
      status: {
        status_code: 'Canceled',
        description: 'Tour cancelado'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Tour cancelado',
          description: 'Tour cancelado'
        }
      }
    }, {
      new: true,
      session
    })

    if (!newTour) {
      res.status(400)
      throw new Error('No se pudo cancelar el tour')
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
    throw new Error(error?.message || 'No se pudo cancelar el tour')
  }
}

const cancelTour = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }
    if (tour?.status?.status_code === 'Canceled') {
      res.status(400)
      throw new Error('El tour ya está cancelado')
    }
    const reservations = await Promise.all(tour.reservations.map(reservation => Reservation.findOne({ _id: reservation._id })))
    if (!reservations) {
      res.status(400)
      throw new Error('No se pudieron obtener todas las reservaciones')
    }
    await cancelReservationsByTourCanceledSession(req, res, tour, reservations)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo cancelar el tour')
    }
  }
})

module.exports = cancelTour
