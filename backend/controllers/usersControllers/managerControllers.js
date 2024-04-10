const asyncHandler = require('express-async-handler')

const User = require('@/models/usersModel')

const setAdmin = asyncHandler(async (req, res) => {
  const userId = req.params.id
  const { isAdmin } = req.body

  // Verificar si se pasan todos los datos
  if (!isAdmin) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  const admin = !(!isAdmin || isAdmin !== 'true')

  try {
    const userExists = await User.findOne({ _id: userId })

    if (!userExists || !userExists.isActive) {
      res.status(400)
      throw new Error('El usuario no se encuentra en la base de datos')
    }

    if (userExists.isManager) {
      res.status(400)
      throw new Error('No se pueden editar los usuarios tipo manager')
    }

    const userUpdated = await User.findByIdAndUpdate(userExists.id, {
      isAdmin: admin,
      tokenVersion: userExists.tokenVersion + 1
    }, { new: true })
    if (userUpdated) {
      res.status(200).json({
        _id: userUpdated.id,
        name: userUpdated.name,
        email: userUpdated.email,
        isAdmin: userUpdated.isAdmin,
        isManager: userUpdated.isManager
      })
    } else {
      res.status(400)
      throw new Error('No se pudieron guardar los cambios')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El usuario no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron guardar los cambios')
    }
  }
})

const removeAccount = asyncHandler(async (req, res) => {
  const userId = req.params.id
  try {
    const userExists = await User.findOne({ _id: userId })

    if (!userExists || !userExists.isActive) {
      res.status(400)
      throw new Error('El usuario no se encuentra en la base de datos')
    }

    if (userExists.isManager) {
      res.status(400)
      throw new Error('No se pueden eliminar los usuarios tipo manager')
    }

    const userUpdated = await User.findByIdAndUpdate(userExists.id, {
      isActive: false,
      tokenVersion: userExists.tokenVersion + 1
    }, { new: true })
    if (userUpdated) {
      res.status(200).json({
        _id: userUpdated.id
      })
    } else {
      res.status(400)
      throw new Error('No se pudo eliminar el usuario')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El usuario no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo eliminar el usuario')
    }
  }
})

module.exports = {
  setAdmin,
  removeAccount
}
