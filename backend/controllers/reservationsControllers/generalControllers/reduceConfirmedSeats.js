const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const reduceConfirmedSeatsSession = async (req, res, comments, reservation, seatsToDelete, tour, client, newSeatsAmount) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const newTourSeats = tour.confirmed_seats.filter(seat => !seatsToDelete.includes(seat))
    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: tour.reserved_seats_amount - seatsToDelete.length,
      $set: {
        confirmed_seats: newTourSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos confirmados liberados',
          description: 'Asientos liberados: [' + seatsToDelete.join(', ') + ']. Reservación: ' + reservation._id,
          user_comments: comments
        }
      }
    }, {
      new: true,
      session
    })

    const newReservedSeats = reservation.confirmed_seats.filter(seat => !seatsToDelete.includes(seat))

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      reserved_seats_amount: newSeatsAmount,
      $set: {
        confirmed_seats: newReservedSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos confirmados liberados',
          description: 'Asientos liberados: [' + seatsToDelete.join(', ') + ']',
          user_comments: comments
        }
      }
    }, { new: true, session })

    const reputationChange = -3 * Math.max(Math.ceil(tour.price * seatsToDelete.length / 1000), 0)

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Asientos confirmados liberados',
          description: 'Cantidad de asientos liberados: ' + seatsToDelete.length + '. Reservación: ' + reservation._id + '. Cambio en reputación: ' + reputationChange.toString() + ' reputación.',
          user_comments: comments
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

const reduceConfirmedSeats = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, seats_to_delete: seatsToDelete } = req.body
  if (!seatsToDelete) {
    throw new Error('Debes ingresar todos los datos')
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code !== 'Completed' && reservation.status.status_code !== 'Pending devolution') {
      res.status(400)
      throw new Error('La reservación no admite una disminución de la cantidad de asientos reservados')
    }

    if (seatsToDelete.some((seat) => !reservation.confirmed_seats.includes(seat))) {
      res.status(400)
      throw new Error('No se pueden eliminar estos asientos')
    }

    const seatsToDeleteAmount = seatsToDelete.length

    const newSeatsAmount = reservation.reserved_seats_amount - seatsToDeleteAmount
    if (newSeatsAmount <= 0) {
      res.status(400)
      throw new Error('No se puede disminuir esta cantidad de asientos. Considere cancelar la reservación')
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

    await reduceConfirmedSeatsSession(req, res, comments, reservation, seatsToDelete, tour, client, newSeatsAmount)
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

module.exports = reduceConfirmedSeats
