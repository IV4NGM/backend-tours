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

const getNewStatus = (reservation, newAmountPaid) => {
  const maxReputationChange = 3 * Math.floor(reservation.price_to_pay / 1000)
  const maxPendingDevolution = Math.max(newAmountPaid - reservation.price_to_pay, 0)
  if (newAmountPaid > reservation.price_to_pay + 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger. Hacer devolución por monto excedido.',
      reputationChange: maxReputationChange,
      pendingDevolution: maxPendingDevolution,
      isReputationChanged: true
    })
  }
  if (newAmountPaid > reservation.price_to_pay - 1) {
    return ({
      status_code: 'Choose seats',
      description: 'Asientos disponibles para escoger.',
      reputationChange: maxReputationChange,
      pendingDevolution: 0,
      isReputationChanged: true
    })
  }
  if (newAmountPaid >= reservation.price_to_reserve) {
    return ({
      status_code: 'Accepted',
      description: 'Pago mínimo para reservar realizado.',
      reputationChange: 0,
      pendingDevolution: 0,
      isReputationChanged: false
    })
  }
  return ({
    ...reservation.status,
    reputationChange: 0,
    pendingDevolution: 0,
    isReputationChanged: false
  })
}

const makeDepositSession = async (req, res, comments, reservation, client, depositAmount) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const newAmountPaid = reservation.amount_paid + depositAmount
    const { reputationChange, pendingDevolution, isReputationChanged, ...status } = getNewStatus(reservation, newAmountPaid)
    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      amount_paid: newAmountPaid,
      pending_devolution: pendingDevolution,
      $push: {
        history: {
          user: req.user,
          action_type: 'Depósito',
          description: 'Depósito realizado: $' + depositAmount.toString() + (pendingDevolution > 0 ? ('. Devolución pendiente: $' + pendingDevolution.toString()) : ''),
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

const cancelReservationByClientSession = async (req, res, reservation, tour, client) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const newTourSeats = tour.confirmed_seats.filter(seat => !reservation.confirmed_seats.includes(seat))
    await Tour.findOneAndUpdate({ _id: tour._id }, {
      reserved_seats_amount: tour.reserved_seats_amount - reservation.reserved_seats_amount,
      $set: {
        confirmed_seats: newTourSeats
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación: ' + reservation._id
        }
      }
    }, {
      new: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status: {
        status_code: 'Canceled by client',
        description: 'Reservación cancelada por cliente. No hay devoluciones'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación cancelada por cliente. No hay devoluciones'
        }
      }
    }, { new: true, session })

    let reputationChange = Math.max(Math.ceil(tour.price * reservation.reserved_seats_amount / 1000), 0)
    if (reservation.status.status_code === 'Pending') {
      reputationChange = -1 * reputationChange
    } else if (reservation.status.status_code === 'Accepted') {
      reputationChange = -2 * reputationChange
    } else {
      reputationChange = -3 * reputationChange
    }

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada por cliente',
          description: 'Reservación: ' + reservation._id + '. ' + reputationChange.toString() + ' reputación.'
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

const cancelReservationByClient = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { devolutions } = req.body

  let makeDevolutions = true
  if (req.user.isAdmin) {
    makeDevolutions = !devolutions || devolutions !== 'false'
  }

  try {
    const reservation = await Reservation.findOne({ _id: reservationId })
    if (!reservation || !reservation.isActive) {
      res.status(400)
      throw new Error('La reservación no se encuentra en la base de datos')
    }

    if (reservation.status.status_code === 'Canceled by client' || reservation.status.status_code === 'Tour canceled' || reservation.status.status_code === 'Canceled') {
      res.status(400)
      throw new Error('La reservación ya está cancelada')
    }

    if (makeDevolutions && reservation.pending_devolution > 0) {
      res.status(400)
      throw new Error('Realizar las devoluciones correspondientes antes de cancelar')
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

    await cancelReservationByClientSession(req, res, reservation, tour, client)
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
  createReservation,
  makeDeposit,
  chooseSeats,
  makeDevolution,
  changeConfirmedSeats,
  reduceReservedSeatsAmount,
  reduceConfirmedSeats,
  cancelReservationByClient
}
