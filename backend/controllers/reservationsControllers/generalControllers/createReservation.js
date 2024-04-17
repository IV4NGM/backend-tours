const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const createReservationSession = async (req, res, comments, reservationDataToCreate, tour, client) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const reservation = new Reservation({
      ...reservationDataToCreate,
      history: {
        user: req.user,
        action_type: 'Reservación creada',
        description: 'Reservación creada',
        user_comments: comments
      }
    })
    await reservation.save({ session })

    const newReservedSeatsAmount = tour.reserved_seats_amount + reservationDataToCreate.reserved_seats_amount

    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: newReservedSeatsAmount,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación creada',
          description: 'Reservación creada. Id: ' + reservation._id + '. Asientos: ' + reservationDataToCreate.reserved_seats_amount.toString(),
          user_comments: comments
        }
      }
    },
    { new: true, session }
    )

    const reputationIncrease = Math.floor(reservationDataToCreate.price_to_pay / 1000)

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationIncrease,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación creada',
          description: 'Reservación creada. Id: ' + reservation._id + '. +' + reputationIncrease.toString() + ' reputación.',
          user_comments: comments
        }
      }
    },
    { new: true, session })

    await session.commitTransaction()
    session.endSession()
    res.status(201).json(reservation)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    throw new Error('No se pudo crear la reservación')
  }
}

const createReservationSessionWithPromos = async (req, res, comments, reservationDataToCreate, tour, newTourPromos, client) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const reservation = new Reservation({
      ...reservationDataToCreate,
      history: {
        user: req.user,
        action_type: 'Reservación creada',
        description: 'Reservación creada con promoción',
        user_comments: comments
      }
    })
    await reservation.save({ session })

    const newReservedSeatsAmount = tour.reserved_seats_amount + reservationDataToCreate.reserved_seats_amount

    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: newReservedSeatsAmount,
      promos: newTourPromos,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación creada',
          description: 'Reservación creada con promoción. Id: ' + reservation._id + '. Asientos: ' + reservationDataToCreate.reserved_seats_amount.toString(),
          user_comments: comments
        }
      }
    },
    { new: true, session }
    )

    const reputationIncrease = Math.floor(reservationDataToCreate.price_to_pay / 1000)

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationIncrease,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación creada',
          description: 'Reservación creada con promoción. Id: ' + reservation._id + '. +' + reputationIncrease.toString() + ' reputación.',
          user_comments: comments
        }
      }
    },
    { new: true, session })

    await session.commitTransaction()
    session.endSession()
    res.status(201).json(reservation)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(400)
    throw new Error('No se pudo crear la reservación')
  }
}

const createReservation = asyncHandler(async (req, res) => {
  const tourId = req.params.id
  const phoneNumber = req.params.phone
  const { comments, ...reservationData } = req.body

  if (!reservationData.reserved_seats_amount) {
    res.status(400)
    throw new Error('Debes ingresar todos los datos')
  }

  const reservedSeatsAmount = Number(reservationData.reserved_seats_amount)
  if (isNaN(reservedSeatsAmount) || !isFinite(reservedSeatsAmount) || reservedSeatsAmount <= 0 || !Number.isInteger(reservedSeatsAmount)) {
    res.status(400)
    throw new Error('La cantidad de asientos debe ser un entero positivo')
  }

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    const tourAvailableSeatsAmount = tour.total_seats - tour.reserved_seats_amount
    if (reservedSeatsAmount > tourAvailableSeatsAmount) {
      res.status(400)
      if (tourAvailableSeatsAmount === 0) {
        throw new Error('Ya no hay asientos disponibles para este tour')
      } else {
        throw new Error('Solo hay ' + tourAvailableSeatsAmount.toString() + ' asiento(s) disponibles')
      }
    }

    const client = await Client.findOne({ phone_number: phoneNumber })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    const priceToReserve = tour.min_payment * reservedSeatsAmount
    const priceWithoutDiscounts = tour.price * reservedSeatsAmount
    let totalPrice = priceWithoutDiscounts

    const reservationDataToCreate = {
      tour,
      client,
      reserved_seats_amount: reservationData.reserved_seats_amount,
      price_to_reserve: priceToReserve,
      price_without_discounts: priceWithoutDiscounts
    }

    reservationDataToCreate.total_price = totalPrice
    reservationDataToCreate.price_to_pay = totalPrice

    if (reservationData.promo_applied) {
      const promoToApply = reservationData.promo_applied

      if (!promoToApply.code || !promoToApply.amount) {
        res.status(400)
        throw new Error('Ingresa todos los datos de la promoción')
      }
      const promoAmount = Number(promoToApply.amount)
      if (isNaN(promoAmount) || !isFinite(promoAmount) || promoAmount <= 0 || !Number.isInteger(promoAmount)) {
        res.status(400)
        throw new Error('La cantidad de promociones aplicadas debe ser un entero positivo')
      }

      if (!tour.promos) {
        res.status(400)
        throw new Error('Código de promoción no válido')
      }

      const tourPromos = tour.promos

      const validPromo = tourPromos.filter(promo => promo.code === promoToApply.code && promo.isActive && promo.usedCount < promo.amount)
      if (!validPromo) {
        res.status(400)
        throw new Error('Código de promoción no válido')
      }
      const validPromoData = validPromo[0]
      if (!validPromoData) {
        res.status(400)
        throw new Error('Código de promoción no válido')
      }

      if (validPromoData.type === '2x1' && promoAmount * 2 > reservationDataToCreate.reserved_seats_amount) {
        res.status(400)
        throw new Error('No se puede aplicar esta cantidad de promociones')
      }

      if (validPromoData.type === 'percentageDiscount' && promoAmount > 1) {
        res.status(400)
        throw new Error('No se puede aplicar esta cantidad de promociones')
      }

      if (promoAmount > validPromoData.maxUsesPerReservation) {
        res.status(400)
        throw new Error('La promo solo admite ' + validPromoData.maxUsesPerReservation.toString() + ' uso(s) por reservación')
      }
      const availableAmount = validPromoData.amount - validPromoData.usedCount
      if (promoAmount > availableAmount) {
        res.status(400)
        throw new Error('Solo quedan ' + availableAmount.toString() + ' promos de este código')
      }

      const updatedPromo = { ...validPromoData._doc }
      updatedPromo.usedCount = updatedPromo.usedCount + promoAmount

      let newTourPromos = [...tourPromos]
      newTourPromos = newTourPromos.map((originalPromo) => {
        if (originalPromo.code !== validPromoData.code) {
          return originalPromo
        } else {
          return updatedPromo
        }
      })

      switch (validPromoData.type) {
        case '2x1':
          totalPrice = Math.max(totalPrice - tour.price * promoAmount, 0)
          break
        case 'discount':
          totalPrice = Math.max(totalPrice - validPromoData.value, 0)
          break
        case 'percentageDiscount':
          totalPrice = Math.max(Math.min(1 - validPromoData.value / 100, 1), 0) * totalPrice
          break
        default:
          break
      }
      // El precio para reservar es igual al precio total en las promos
      reservationDataToCreate.price_to_reserve = totalPrice
      reservationDataToCreate.total_price = totalPrice
      reservationDataToCreate.price_to_pay = totalPrice

      reservationDataToCreate.promo_applied = {
        type: validPromoData.type,
        value: validPromoData.value,
        amount: promoToApply.amount,
        code: promoToApply.code
      }

      await createReservationSessionWithPromos(req, res, comments, reservationDataToCreate, tour, newTourPromos, client)
      return
    }

    await createReservationSession(req, res, comments, reservationDataToCreate, tour, client)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('Datos incorrectos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo crear la reservación')
    }
  }
})

module.exports = createReservation
