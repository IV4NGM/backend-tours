const asyncHandler = require('express-async-handler')

const Reservation = require('@/models/reservationsModel')

const reducePendingDevolution = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, discount } = req.body
  if (!discount || !comments) {
    throw new Error('Debes ingresar todos los datos')
  }

  const discountAmount = Number(discount)
  if (isNaN(discountAmount) || !isFinite(discountAmount) || discountAmount <= 0) {
    res.status(400)
    throw new Error('La cantidad a disminuir debe ser un número positivo')
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code !== 'Pending devolution') {
      res.status(400)
      throw new Error('La reservación no admite una disminución de devoluciones')
    }

    if (discountAmount > reservation.pending_devolution) {
      res.status(400)
      throw new Error('No se puede disminuir la devolución por esta cantidad')
    }
    const status = discountAmount === reservation.pending_devolution ? reservation.status.next_status : reservation.status
    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservationId }, {
      status,
      pending_devolution: Math.max(reservation.pending_devolution - discountAmount, 0),
      $push: {
        history: {
          user: req.user,
          action_type: 'Devolución pendiente disminuida',
          description: 'Cantidad anterior: $' + reservation.pending_devolution.toString() + '. Cantidad descontada: $' + discountAmount.toString() + '. Valor nuevo: $' + Math.max(reservation.pending_devolution - discountAmount, 0).toString(),
          user_comments: comments
        }
      }
    }, { new: true })

    if (updatedReservation) {
      res.status(200).json(updatedReservation)
    } else {
      res.status(400)
      throw new Error('No se pudo actualizar la reservación')
    }
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

module.exports = reducePendingDevolution
