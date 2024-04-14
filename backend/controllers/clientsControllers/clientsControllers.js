const asyncHandler = require('express-async-handler')

const Client = require('@/models/clientsModel')

const createClient = asyncHandler(async (req, res) => {
  const clientData = req.body

  if (!clientData.name || !clientData.phone_number) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  const { comments, ...clientDataToCreate } = clientData

  const clientExists = await Client.findOne({ phone_number: clientData.phone_number })
  if (clientExists) {
    if (clientExists.isActive) {
      res.status(400)
      throw new Error('Ya se encuentra registrado un cliente con este número')
    } else {
      const updatedClient = await Client.findOneAndUpdate(clientExists, {
        ...clientDataToCreate,
        isActive: true,
        $push: {
          history: {
            user: req.user,
            action_type: 'Cliente creado',
            description: 'Cliente creado (previamente existente)',
            user_comments: comments
          }
        }
      }, { new: true })

      if (updatedClient) {
        res.status(200).json(updatedClient)
      } else {
        res.status(400)
        throw new Error('No se pudo crear el cliente')
      }
    }
  } else {
    const clientCreated = await Client.create({
      ...clientDataToCreate,
      history: {
        user: req.user,
        action_type: 'Cliente creado',
        description: 'Cliente creado',
        user_comments: comments
      }
    })

    if (clientCreated) {
      res.status(200).json(clientCreated)
    } else {
      res.status(400)
      throw new Error('No se pudo crear el cliente')
    }
  }
})

const getClient = asyncHandler(async (req, res) => {
  const phoneNumber = req.params.phone

  try {
    const client = await Client.findOne({ phone_number: phoneNumber })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    } else {
      res.status(200).json(client)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El cliente no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo obtener el cliente')
    }
  }
})

const getAllClients = asyncHandler(async (req, res) => {
  const clients = await Client.find({ isActive: true })
  if (clients) {
    res.status(200).json(clients)
  } else {
    res.status(400)
    throw new Error('No se puede mostrar la información en este momento')
  }
})

const updateClient = asyncHandler(async (req, res) => {
  const phoneNumber = req.params.phone
  const clientData = req.body

  if (!clientData.name && !clientData.email) {
    res.status(400)
    throw new Error('Debes ingresar al menos un campo para actualizar')
  }

  try {
    const client = await Client.findOne({ phone_number: phoneNumber })

    if (!client || !client.isActive) {
      res.status(400)
      throw new Error('El cliente no se encuentra en la base de datos')
    }
    const { comments, ...clientDataToUpdate } = clientData

    const updatedClient = await Client.findOneAndUpdate(client, {
      ...clientDataToUpdate,
      $push: {
        history: {
          user: req.user,
          action_type: 'Cliente modificado',
          description: 'Cliente modificado',
          user_comments: comments
        }
      }
    }, { new: true })

    if (updatedClient) {
      res.status(200).json(updatedClient)
    } else {
      res.status(400)
      throw new Error('No se pudo modificar el cliente')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El cliente no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo obtener el cliente')
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
  createClient,
  getClient,
  getAllClients,
  updateClient,
  deleteClient
}
