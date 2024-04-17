const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const cancelReservationByClientSession = async (req, res, reservation, tour, client) => {
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
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación: ' + reservation._id
        }
      }
    }, {
      new: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status: {
        status_code: 'Canceled by client',
        description: 'Reservación cancelada por cliente. No hay devoluciones'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación cancelada por cliente. No hay devoluciones'
        }
      }
    }, { new: true, session })

    let reputationChange = Math.max(Math.ceil(tour.price * reservation.reserved_seats_amount / 1000), 0)
    if (reservation.status.status_code === 'Pending') {
      reputationChange = -1 * reputationChange
    } else if (reservation.status.status_code === 'Accepted') {
      reputationChange = -2 * reputationChange
    } else {
      reputationChange = -3 * reputationChange
    }

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación: ' + reservation._id + '. ' + reputationChange.toString() + ' reputación.'
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

const cancelReservationByClient = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { devolutions } = req.body

  let makeDevolutions = true
  if (req.user.isAdmin) {
    makeDevolutions = !devolutions || devolutions !== 'false'
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

    if (makeDevolutions && reservation.pending_devolution > 0) {
      res.status(400)
      throw new Error('Realizar las devoluciones correspondientes antes de cancelar')
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

    await cancelReservationByClientSession(req, res, reservation, tour, client)
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

module.exports = cancelReservationByClient
