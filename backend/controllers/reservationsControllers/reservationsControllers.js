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
        throw new Error('Solo quedan ' + tourAvailableSeatsAmount.toString() + ' asientos disponibles')
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

const getNewStatus = (reservation, newAmountPaid) => {
  const maxReputationChange = Math.floor(reservation.price_to_pay / 1000)
  const maxPendingDevolution = Math.max(newAmountPaid - reservation.price_to_pay, 0)
  if (newAmountPaid > reservation.price_to_pay + 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger. Hacer devolución por monto excedido.',
      reputationChange: maxReputationChange,
      pendingDevolution: maxPendingDevolution
    })
  }
  if (newAmountPaid > reservation.price_to_pay - 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger.',
      reputationChange: maxReputationChange,
      pendingDevolution: 0
    })
  }
  if (newAmountPaid >= reservation.price_to_reserve) {
    return ({
      status_code: 'Accepted',
      description: 'Pago mínimo para reservar realizado.',
      reputationChange: 0,
      pendingDevolution: 0
    })
  }
  return { ...reservation.status, reputationChange: 0 }
}

const makeDepositSession = async (req, res, comments, reservation, client, depositAmount) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const newAmountPaid = reservation.amount_paid + depositAmount
    const { reputationChange, pendingDevolution, ...status } = getNewStatus(reservation, newAmountPaid)
    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      amount_paid: newAmountPaid,
      pending_devolution: pendingDevolution,
      $push: {
        history: {
          user: req.user,
          action_type: 'Depósito',
          description: 'Depósito realizado: $' + depositAmount.toString(),
          user_comments: comments
        }
      }
    }, { new: true, session })

    if (reputationChange > 0) {
      await Client.findOneAndUpdate({ _id: client._id }, {
        reputation: client.reputation + reputationChange,
        $push: {
          reservations: reservation,
          history: {
            user: req.user,
            action_type: 'Reservación pagada',
            description: 'Reservación pagada. Id: ' + reservation._id + '. +' + reputationChange.toString() + ' reputación.',
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
    throw new Error('No se pudo crear el depósito')
  }
}

const makeDeposit = asyncHandler(async (req, res) => {
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

    if (reservation.status.status_code !== 'Pending' && reservation.status.status_code !== 'Accepted') {
      res.status(400)
      throw new Error('La reservación no admite nuevos depósitos')
    }

    const client = await Client.findOne({ _id: reservation.client._id })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    await makeDepositSession(req, res, comments, reservation, client, depositAmount)
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La reservación no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo crear el depósito')
    }
  }
})

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

module.exports = {
  createReservation,
  makeDeposit,
  chooseSeats,
  makeDevolution
}
