const asyncHandler = require('express-async-handler')

const Reservation = require('@/models/reservationsModel')

const makeDevolution = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, ...depositData } = req.body
  if (!depositData.deposit_amount) {
    throw new Error('Debes ingresar todos los datos')
  }

  const depositAmount = Number(depositData.deposit_amount)
  if (isNaN(depositAmount) || !isFinite(depositAmount) || depositAmount <= 0) {
    res.status(400)
    throw new Error('La cantidad depositada debe ser un número positivo')
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code !== 'Pending devolution') {
      res.status(400)
      throw new Error('La reservación no admite devoluciones')
    }
    let newStatus
    if (depositAmount < reservation.pending_devolution) {
      newStatus = reservation.status
    } else {
      newStatus = reservation.status.next_status
    }

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservationId }, {
      status: newStatus,
      pending_devolution: Math.max(reservation.pending_devolution - depositAmount, 0),
      $push: {
        history: {
          user: req.user,
          action_type: 'Devolución realizada',
          description: 'Devolución realizada: $' + depositAmount.toString(),
          user_comments: comments
        }
      }
    }, { new: true })

    if (updatedReservation) {
      res.status(200).json(updatedReservation)
    } else {
      res.status(400)
      throw new Error('No se pudo realizar la devolución')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La reservación no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo realizar la devolución')
    }
  }
})

module.exports = makeDevolution
