const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Reservation = require('@/models/reservationsModel')

const changeConfirmedSeatsSession = async (req, res, comments, reservation, selectedSeats, tour) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const seatsToRemove = reservation.confirmed_seats.filter(seat => !selectedSeats.includes(seat))
    const seatsToAdd = selectedSeats.filter(seat => !reservation.confirmed_seats.includes(seat))

    const newTourSeats = tour.confirmed_seats.filter(seat => !seatsToRemove.includes(seat)).concat(seatsToAdd)
    const newReservationSeats = reservation.confirmed_seats.filter(seat => !seatsToRemove.includes(seat)).concat(seatsToAdd)
    await Tour.findOneAndUpdate({ _id: reservation.tour._id }, {
      $set: {
        confirmed_seats: newTourSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos cambiados',
          description: 'Asientos anteriores: ' + reservation.confirmed_seats.join(', ') + '. Asientos nuevos: ' + selectedSeats.join(', ') + '. Reservación: ' + reservation._id,
          user_comments: comments
        }
      }
    }, {
      new: true,
      runValidators: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      $set: {
        confirmed_seats: newReservationSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos cambiados',
          description: 'Asientos anteriores: ' + reservation.confirmed_seats.join(', ') + '. Asientos nuevos: ' + selectedSeats.join(', '),
          user_comments: comments
        }
      }
    }, { new: true, session })

    await session.commitTransaction()
    session.endSession()
    res.status(200).json(updatedReservation)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    console.error(error)
    throw new Error('No se pudieron cambiar los asientos')
  }
}

const changeConfirmedSeats = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, selected_seats: selectedSeats } = req.body
  if (!selectedSeats) {
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
      throw new Error('La reservación no permite cambiar asientos')
    }

    if (selectedSeats.length !== reservation.reserved_seats_amount) {
      res.status(400)
      throw new Error('El número de asientos no coincide con el de la reservación')
    }

    const tour = await Tour.findOne({ _id: reservation.tour._id })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    const availableSeats = tour.total_seats_numbers.filter((seat) => !tour.confirmed_seats.includes(seat))
    if (selectedSeats.some((seat) => !reservation.confirmed_seats.includes(seat) && !availableSeats.includes(seat))) {
      res.status(400)
      throw new Error('Asientos no disponibles')
    }
    await changeConfirmedSeatsSession(req, res, comments, reservation, selectedSeats, tour)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('No se encuentran los datos de la reservación')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron cambiar los asientos')
    }
  }
})

module.exports = changeConfirmedSeats
