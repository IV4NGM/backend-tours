const mongoose = require('mongoose')
const asyncHandler = require('express-async-handler')

const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

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

module.exports = makeDeposit
