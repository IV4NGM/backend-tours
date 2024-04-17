const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const cancelReservationWithDevolutionsSession = async (req, res, reservation, tour, client, returnType) => {
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

    let devolutions = 0
    let status = { ...reservation.status }
    if (returnType === 'total') {
      devolutions = reservation.amount_paid
    } else if (reservation.amount_paid > reservation.price_to_reserve) {
      devolutions = reservation.amount_paid - reservation.price_to_reserve
    }

    if (devolutions > 0) {
      status = {
        status_code: 'Pending devolution',
        description: 'Reservación cancelada. Devolución pendiente.',
        next_status: {
          status_code: 'Canceled',
          description: 'Reservación cancelada'
        }
      }
    } else {
      status = {
        status_code: 'Canceled',
        description: 'Reservación cancelada'
      }
    }

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      pending_devolution: devolutions,
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación cancelada'
        }
      }
    }, { new: true, session })

    await Client.findOneAndUpdate({ _id: client._id }, {
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id
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

const cancelReservationWithDevolutions = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { return_type: returnTypeBody } = req.body

  let returnType = 'partial'
  if (returnTypeBody === 'total') {
    returnType = 'total'
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

    await cancelReservationWithDevolutionsSession(req, res, reservation, tour, client, returnType)
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

module.exports = cancelReservationWithDevolutions
