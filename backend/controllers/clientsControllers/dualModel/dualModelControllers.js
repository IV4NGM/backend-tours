const asyncHandler = require('express-async-handler')

const Client = require('@/models/clientsModel')
const Reservation = require('@/models/reservationsModel')

const getAllReservations = asyncHandler(async (req, res) => {
  const phoneNumber = req.params.phone

  try {
    const client = await Client.findOne({ phone_number: phoneNumber })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    const reservations = await Promise.all(client.reservations.map(reservation => Reservation.findOne({ _id: reservation._id })))

    if (reservations) {
      res.status(200).json(reservations)
    } else {
      res.status(400)
      throw new Error('No se pudieron obtener todas las reservaciones')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El cliente no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron obtener todas las reservaciones')
    }
  }
})

const deleteClient = asyncHandler(async (req, res) => {
  const phoneNumber = req.params.phone

  try {
    const client = await Client.findOne({ phone_number: phoneNumber })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }

    // Agregar verificación de que todas las reservas estén correctas antes de eliminar

    const reservations = await Promise.all(client.reservations.map(reservation => Reservation.findOne({ _id: reservation._id })))

    if (!reservations) {
      res.status(400)
      throw new Error('No se pudieron obtener todas las reservaciones para verificar status')
    }

    const notAllowedStatusArray = ['Pending', 'Accepted', 'Choose seats', 'Pending devolution']

    if (reservations.some(reservation => notAllowedStatusArray.includes(reservation.status.status_code))) {
      res.status(400)
      throw new Error('No se puede eliminar el cliente porque alguna reservación no está completa o cancelada')
    }

    const updatedClient = await Client.findOneAndUpdate({ phone_number: phoneNumber }, {
      isActive: false,
      $push: {
        history: {
          user: req.user,
          action_type: 'Cliente eliminado',
          description: 'Cliente eliminado'
        }
      }
    }, { new: true })

    if (updatedClient) {
      res.status(200).json({ phone_number: phoneNumber })
    } else {
      res.status(400)
      throw new Error('No se pudo eliminar el cliente')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El cliente no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo eliminar el cliente')
    }
  }
})

module.exports = {
  getAllReservations,
  deleteClient
}
