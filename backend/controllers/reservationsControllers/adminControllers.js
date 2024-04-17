const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const getNewStatusAfterDiscount = (reservation, newPriceToReserve, newPriceToPay) => {
  const maxReputationChange = 3 * Math.floor(newPriceToPay / 1000)
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

const cancelReservationWithoutDevolutionsSession = async (req, res, reservation, tour, client, changeReputation) => {
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
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id
        }
      }
    }, {
      new: true,
      session
    })

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status: {
        status_code: 'Canceled',
        description: 'Reservación cancelada. No hay devoluciones'
      },
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación cancelada. No hay devoluciones'
        }
      }
    }, { new: true, session })

    let reputationChange = Math.max(Math.ceil(tour.price * reservation.reserved_seats_amount / 1000), 0)

    if (changeReputation) {
      if (reservation.status.status_code === 'Pending') {
        reputationChange = -1 * reputationChange
      } else if (reservation.status.status_code === 'Accepted') {
        reputationChange = -2 * reputationChange
      } else {
        reputationChange = -3 * reputationChange
      }
    } else {
      reputationChange = 0
    }

    await Client.findOneAndUpdate({ _id: client._id }, {
      reputation: client.reputation + reputationChange,
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id + '. Cambio en reputación: ' + reputationChange.toString() + ' reputación.'
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

const cancelReservationWithoutDevolutions = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { change_reputation: changeReputationBody } = req.body

  let changeReputation = true
  if (changeReputationBody === 'false') {
    changeReputation = false
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

    await cancelReservationWithoutDevolutionsSession(req, res, reservation, tour, client, changeReputation)
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

const cancelReservationWithDevolutionsSession = async (req, res, reservation, tour, client, returnType) => {
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
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id
        }
      }
    }, {
      new: true,
      session
    })

    let devolutions = 0
    let status = { ...reservation.status }
    if (returnType === 'total') {
      devolutions = reservation.amount_paid
    } else if (reservation.amount_paid > reservation.price_to_reserve) {
      devolutions = reservation.amount_paid - reservation.price_to_reserve
    }

    if (devolutions > 0) {
      status = {
        status_code: 'Pending devolution',
        description: 'Reservación cancelada. Devolución pendiente.',
        next_status: {
          status_code: 'Canceled',
          description: 'Reservación cancelada'
        }
      }
    } else {
      status = {
        status_code: 'Canceled',
        description: 'Reservación cancelada'
      }
    }

    const updatedReservation = await Reservation.findOneAndUpdate({ _id: reservation._id }, {
      status,
      pending_devolution: devolutions,
      $push: {
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación cancelada'
        }
      }
    }, { new: true, session })

    await Client.findOneAndUpdate({ _id: client._id }, {
      $push: {
        reservations: reservation,
        history: {
          user: req.user,
          action_type: 'Reservación cancelada',
          description: 'Reservación: ' + reservation._id
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

const cancelReservationWithDevolutions = asyncHandler(async (req, res) => {
  const reservationId = req.params.id
  const { return_type: returnTypeBody } = req.body

  let returnType = 'partial'
  if (returnTypeBody === 'total') {
    returnType = 'total'
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

    await cancelReservationWithDevolutionsSession(req, res, reservation, tour, client, returnType)
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
  reduceAmountPaid,
  cancelReservationWithoutDevolutions,
  cancelReservationWithDevolutions
}
