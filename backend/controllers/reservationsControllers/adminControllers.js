const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const getNewStatusAfterDiscount = (reservation, newPriceToReserve, newPriceToPay) => {
  const maxReputationChange = Math.floor(newPriceToPay / 1000)
  if (reservation.amount_paid > newPriceToPay - 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger.',
      reputationChange: maxReputationChange,
      isReputationChanged: true
    })
  }
  if (reservation.amount_paid >= newPriceToReserve) {
    return ({
      status_code: 'Accepted',
      description: 'Pago mínimo para reservar realizado.',
      reputationChange: 0,
      isReputationChanged: false
    })
  }
  return ({
    ...reservation.status,
    reputationChange: 0,
    isReputationChanged: false
  })
}

const addDiscountSession = async (req, res, comments, reservation, newPriceToReserve, newPriceToPay, discountAmount, client) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { reputationChange, isReputationChanged, ...status } = getNewStatusAfterDiscount(reservation, newPriceToReserve, newPriceToPay)
    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      price_to_reserve: newPriceToReserve,
      price_to_pay: newPriceToPay,
      has_extra_discounts: true,
      $push: {
        history: {
          user: req.user,
          action_type: 'Descuento agregado',
          description: 'Descuento agregado: $' + discountAmount.toString(),
          user_comments: comments
        }
      }
    }, { new: true, session })

    if (isReputationChanged) {
      await Client.findOneAndUpdate({ _id: client._id }, {
        reputation: client.reputation + reputationChange,
        $push: {
          reservations: reservation,
          history: {
            user: req.user,
            action_type: 'Reservación pagada',
            description: 'Reservación pagada por descuento. Id: ' + reservation._id + '. +' + reputationChange?.toString() + ' reputación.',
            user_comments: comments
          }
        }
      },
      { new: true, session })
    }

    await session.commitTransaction()
    session.endSession()
    res.status(200).json(updatedReservation)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    throw new Error('No se pudo crear el descuento')
  }
}

const addDiscount = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, discount } = req.body
  if (!discount || !comments) {
    throw new Error('Debes ingresar todos los datos')
  }

  const discountAmount = Number(discount)
  if (isNaN(discountAmount) || !isFinite(discountAmount) || discountAmount <= 0) {
    res.status(400)
    throw new Error('El descuento debe ser un número positivo')
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code !== 'Pending' && reservation.status.status_code !== 'Accepted') {
      res.status(400)
      throw new Error('La reservación no admite nuevos descuentos')
    }

    const newPriceToPay = reservation.price_to_pay - discountAmount
    if (newPriceToPay < 0 || newPriceToPay < reservation.amount_paid) {
      res.status(400)
      throw new Error('No se puede aplicar este descuento')
    }
    const newPriceToReserve = Math.min(reservation.price_to_reserve, newPriceToPay)

    const client = await Client.findOne({ _id: reservation.client._id })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    await addDiscountSession(req, res, comments, reservation, newPriceToReserve, newPriceToPay, discountAmount, client)
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

module.exports = {
  addDiscount,
  reducePendingDevolution,
  reduceAmountPaid
}
