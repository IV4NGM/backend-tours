const bcrypt = require('bcryptjs')
const asyncHandler = require('express-async-handler')

const User = require('@/models/usersModel')

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, isAdmin } = req.body

  // Verificar si se pasan todos los datos
  if (!name || !email || !password) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  // Establecer la propiedad isAdmin solo si es un usuario tipo Manager
  let admin = false
  if (req.user.isManager) {
    admin = !(!isAdmin || isAdmin !== 'true')
  }

  // Hacer el Hash al password
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  let userRegistered

  // Verificar que el email no esté registrado
  const userExists = await User.findOne({ email })
  if (userExists) {
    if (userExists.isActive) {
      res.status(400)
      throw new Error('El email ya está registrado en la base de datos')
    } else {
      userRegistered = await User.findByIdAndUpdate(userExists.id, {
        name,
        email,
        password: hashedPassword,
        isAdmin: admin,
        isActive: true,
        tokenVersion: userExists.tokenVersion + 1
      }, { new: true })

      if (!userRegistered) {
        res.status(400)
        throw new Error('No se pudieron guardar los datos')
      }
    }
  } else {
    // Crear el usuario
    userRegistered = await User.create({
      name,
      email,
      password: hashedPassword,
      isAdmin: admin
    })

    if (!userRegistered) {
      res.status(400)
      throw new Error('No se pudieron guardar los datos')
    }
  }
  if (userRegistered) {
    res.status(201).json({
      _id: userRegistered.id,
      name: userRegistered.name,
      email: userRegistered.email,
      isAdmin: userRegistered.isAdmin,
      isManager: userRegistered.isManager
    })
  }
})

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true }).select('-password -isActive -tokenVersion')
  if (users) {
    res.status(200).json(users)
  } else {
    res.status(400)
    throw new Error('No se puede mostrar la información en este momento')
  }
})

module.exports = {
  createUser,
  getAllUsers
}
