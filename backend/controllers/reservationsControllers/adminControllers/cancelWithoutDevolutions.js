const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const cancelReservationWithoutDevolutionsSession = async (req, res, reservation, tour, client, changeReputation) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const newTourSeats = tour.confirmed_seats.filter(seat => !reservation.confirmed_seats.includes(seat))
    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: tour.reserved_seats_amount - reservation.reserved_seats_amount,
      $set: {
        confirmed_seats: newTourSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id
        }
      }
    }, {
      new: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status: {
        status_code: 'Canceled',
        description: 'Reservación cancelada. No hay devoluciones'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación cancelada. No hay devoluciones'
        }
      }
    }, { new: true, session })

    let reputationChange = Math.max(Math.ceil(tour.price * reservation.reserved_seats_amount / 1000), 0)

    if (changeReputation) {
      if (reservation.status.status_code === 'Pending') {
        reputationChange = -1 * reputationChange
      } else if (reservation.status.status_code === 'Accepted') {
        reputationChange = -2 * reputationChange
      } else {
        reputationChange = -3 * reputationChange
      }
    } else {
      reputationChange = 0
    }

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id + '. Cambio en reputación: ' + reputationChange.toString() + ' reputación.'
        }
      }
    },
    { new: true, session })

    await session.commitTransaction()
    session.endSession()
    res.status(200).json(updatedReservation)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    console.error(error)
    throw new Error('No se pudo actualizar la reservación')
  }
}

const cancelReservationWithoutDevolutions = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { change_reputation: changeReputationBody } = req.body

  let changeReputation = true
  if (changeReputationBody === 'false') {
    changeReputation = false
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code === 'Canceled by client' || reservation.status.status_code === 'Tour canceled' || reservation.status.status_code === 'Canceled') {
      res.status(400)
      throw new Error('La reservación ya está cancelada')
    }

    const tour = await Tour.findOne({ _id: reservation.tour._id })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    const client = await Client.findOne({ _id: reservation.client._id })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    await cancelReservationWithoutDevolutionsSession(req, res, reservation, tour, client, changeReputation)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La reservación no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo actualizar la reservación')
    }
  }
})

module.exports = cancelReservationWithoutDevolutions
