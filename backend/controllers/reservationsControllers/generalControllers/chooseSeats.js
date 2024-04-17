const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Reservation = require('@/models/reservationsModel')

const getStatusAfterChoosingSeats = (reservation) => {
  if (reservation.pending_devolution > 0) {
    return ({
      status_code: 'Pending devolution',
      description: 'Reservación completa. Devolución pendiente.',
      next_status: {
        status_code: 'Completed',
        description: 'Reservación completa'
      }
    })
  }
  return ({
    status_code: 'Completed',
    description: 'Reservación completa'
  })
}

const chooseSeatsSession = async (req, res, comments, reservation, selectedSeats) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const status = getStatusAfterChoosingSeats(reservation)

    await Tour.findOneAndUpdate({ _id: reservation.tour._id }, {
      $push: {
        confirmed_seats: {
          $each: selectedSeats
        },
        history: {
          user: req.user,
          action_type: 'Asientos escogidos',
          description: 'Asientos escogidos: ' + selectedSeats.join(', ') + '. Reservación: ' + reservation._id,
          user_comments: comments
        }
      }
    }, {
      new: true,
      runValidators: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      confirmed_seats: selectedSeats,
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos escogidos',
          description: 'Asientos escogidos: ' + selectedSeats.join(', '),
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
    throw new Error('No se pudieron seleccionar los asientos')
  }
}

const chooseSeats = asyncHandler(async (req, res) => {
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

    if (reservation.status.status_code !== 'Choose seats') {
      res.status(400)
      throw new Error('La reservación no permite escoger asientos')
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
    if (selectedSeats.some((seat) => !availableSeats.includes(seat))) {
      res.status(400)
      throw new Error('Asientos no disponibles')
    }
    await chooseSeatsSession(req, res, comments, reservation, selectedSeats)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('No se encuentran los datos de la reservación')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron escoger los asientos')
    }
  }
})

module.exports = chooseSeats
