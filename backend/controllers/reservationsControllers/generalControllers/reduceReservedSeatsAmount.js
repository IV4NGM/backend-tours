const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const getNewStatusAfterReducingSeatsAmount = (reservation, newPriceToPay, newPriceToReserve) => {
  let reputationToReduce = Math.ceil(Math.max((reservation.price_to_pay - newPriceToPay) / 1000, 0))
  if (reservation.status.status_code === 'Accepted') {
    reputationToReduce = reputationToReduce * 2
  }
  const maxReputationToAdd = 3 * Math.floor(newPriceToPay / 1000)
  const maxPendingDevolution = Math.max(reservation.amount_paid - newPriceToPay, 0)
  if (reservation.amount_paid > newPriceToPay + 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger. Hacer devolución por monto excedido.',
      reputationChange: maxReputationToAdd - reputationToReduce,
      pendingDevolution: maxPendingDevolution
    })
  }
  if (reservation.amount_paid > newPriceToPay - 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger.',
      reputationChange: maxReputationToAdd - reputationToReduce,
      pendingDevolution: 0
    })
  }
  if (reservation.amount_paid >= newPriceToReserve) {
    return ({
      status_code: 'Accepted',
      description: 'Pago mínimo para reservar realizado.',
      reputationChange: -reputationToReduce,
      pendingDevolution: 0
    })
  }
  return ({
    ...reservation.status,
    reputationChange: -reputationToReduce,
    pendingDevolution: 0
  })
}

const reduceReservedSeatsAmountSession = async (req, res, comments, reservation, seatsAmountToReduce, newSeatsAmount, tour, generateSurcharge, client) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    let newPriceToReserve = tour.min_payment * newSeatsAmount
    let newPriceToPay = tour.price * newSeatsAmount
    const newPromoApplied = { ...reservation.promo_applied }

    if (reservation.promo_applied?.type) {
      if (newPromoApplied.type === '2x1') {
        newPromoApplied.amount = Math.min(Math.floor(newSeatsAmount / 2), newPromoApplied.amount)
      }

      switch (newPromoApplied.type) {
        case '2x1':
          newPriceToPay = Math.max(newPriceToPay - tour.price * newPromoApplied.amount, 0)
          break
        case 'discount':
          newPriceToPay = Math.max(newPriceToPay - newPromoApplied.value, 0)
          break
        case 'percentageDiscount':
          newPriceToPay = Math.max(Math.min(1 - newPromoApplied.value / 100, 1), 0) * newPriceToPay
          break
        default:
          break
      }
      // El precio para reservar es igual al precio total en las promos
      newPriceToReserve = newPriceToPay
    } else {
      if (reservation.status.status_code === 'Accepted' && generateSurcharge) {
        newPriceToReserve = newPriceToReserve + tour.min_payment * seatsAmountToReduce
        newPriceToPay = newPriceToPay + tour.min_payment * seatsAmountToReduce
      }
    }

    const { pendingDevolution, reputationChange, ...status } = getNewStatusAfterReducingSeatsAmount(reservation, newPriceToPay, newPriceToReserve)

    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: tour.reserved_seats_amount - seatsAmountToReduce,
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos reservados liberados',
          description: 'Cantidad de asientos liberados: ' + seatsAmountToReduce + '. Reservación: ' + reservation._id,
          user_comments: comments
        }
      }
    }, {
      new: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      pending_devolution: pendingDevolution,
      promo_applied: newPromoApplied,
      reserved_seats_amount: newSeatsAmount,
      price_to_pay: newPriceToPay,
      price_to_reserve: newPriceToReserve,
      $push: {
        history: {
          user: req.user,
          action_type: 'Asientos reservados liberados',
          description: 'Cantidad de asientos liberados: ' + seatsAmountToReduce,
          user_comments: comments
        }
      }
    }, { new: true, session })

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Asientos reservados liberados',
          description: 'Cantidad de asientos liberados: ' + seatsAmountToReduce + '. Reservación: ' + reservation._id + '. Cambio en reputación: ' + reputationChange.toString() + ' reputación.',
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
    throw new Error('No se pudo actualizar la reservación')
  }
}

const reduceReservedSeatsAmount = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { comments, seats_amount: seatsAmount, surcharge } = req.body
  if (!seatsAmount) {
    throw new Error('Debes ingresar todos los datos')
  }

  let generateSurcharge = true
  if (req.user.isAdmin) {
    generateSurcharge = !surcharge || surcharge !== 'false'
  }

  const seatsAmountToReduce = Number(seatsAmount)
  if (isNaN(seatsAmountToReduce) || !isFinite(seatsAmountToReduce) || seatsAmountToReduce <= 0 || !Number.isInteger(seatsAmountToReduce)) {
    res.status(400)
    throw new Error('La cantidad de asientos a disminuir debe ser un entero positivo')
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code !== 'Pending' && reservation.status.status_code !== 'Accepted') {
      res.status(400)
      throw new Error('La reservación no admite una disminución de la cantidad de asientos reservados')
    }

    const newSeatsAmount = reservation.reserved_seats_amount - seatsAmountToReduce
    if (newSeatsAmount <= 0) {
      res.status(400)
      throw new Error('No se puede disminuir esta cantidad de asientos')
    }

    if (reservation.has_extra_discounts) {
      res.status(400)
      throw new Error('No se pueden disminuir asientos de reservas con descuentos extra')
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

    await reduceReservedSeatsAmountSession(req, res, comments, reservation, seatsAmountToReduce, newSeatsAmount, tour, generateSurcharge, client)
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

module.exports = reduceReservedSeatsAmount
