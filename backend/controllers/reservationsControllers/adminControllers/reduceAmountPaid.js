const asyncHandler = require('express-async-handler')

const Reservation = require('@/models/reservationsModel')

const reduceAmountPaid = asyncHandler(async (req, res) => {
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

    if (reservation.status.status_code !== 'Pending' && reservation.status.status_code !== 'Accepted') {
      res.status(400)
      throw new Error('La reservación no admite una disminución de la cantidad pagada')
    }

    const newAmountPaid = reservation.amount_paid - discountAmount
    if (newAmountPaid < 0) {
      res.status(400)
      throw new Error('No se puede disminuir la cantidad pagada por esta cantidad')
    }

    let status
    if (newAmountPaid >= reservation.price_to_reserve) {
      status = {
        status_code: 'Accepted',
        description: 'Pago mínimo para reservar realizado.'
      }
    } else {
      status = {
        status_code: 'Pending',
        description: 'Pago mínimo para reservar pendiente.'
      }
    }

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservationId }, {
      status,
      amount_paid: Math.max(newAmountPaid, 0),
      $push: {
        history: {
          user: req.user,
          action_type: 'Cantidad pagada disminuida',
          description: 'Cantidad anterior: $' + reservation.amount_paid.toString() + '. Cantidad descontada: $' + discountAmount.toString() + '. Valor nuevo: $' + Math.max(newAmountPaid, 0).toString(),
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

module.exports = reduceAmountPaid
