const bcrypt = require('bcryptjs')
const asyncHandler = require('express-async-handler')

const User = require('@/models/usersModel')

const generateToken = require('./generateToken')

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  // Verificamos si el usuario existe y también su password
  const user = await User.findOne({ email })
  if (user && user.isActive && (await bcrypt.compare(password, user.password))) {
    res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
      isManager: user.isManager,
      token: generateToken(user.id, user.tokenVersion)
    })
  } else {
    res.status(400)
    throw new Error('Credenciales incorrectas')
  }
})

const getUser = asyncHandler(async (req, res) => {
  const user = req.user.toObject()
  delete user.isActive
  delete user.tokenVersion
  res.status(200).json(user)
})

const updatePassword = asyncHandler(async (req, res) => {
  const { password, newPassword, logout } = req.body
  if (!password || !newPassword) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  const user = await User.findById(req.user._id)

  if (await bcrypt.compare(password, user.password)) {
    const newTokenVersion = logout === 'false' ? user.tokenVersion : user.tokenVersion + 1
    const salt = await bcrypt.genSalt(10)
    const newHashedPassword = await bcrypt.hash(newPassword, salt)

    const userUpdated = await User.findByIdAndUpdate(req.user.id, {
      password: newHashedPassword,
      tokenVersion: newTokenVersion
    }, { new: true })
    if (userUpdated) {
      res.status(200).json({
        _id: userUpdated.id,
        name: userUpdated.name,
        email: userUpdated.email,
        isAdmin: userUpdated.isAdmin,
        isManager: userUpdated.isManager,
        logout: logout !== 'false'
      })
    } else {
      res.status(400)
      throw new Error('No se pudo actualizar la contraseña')
    }
  } else {
    res.status(400)
    throw new Error('Contraseña incorrecta')
  }
})

const updateUser = asyncHandler(async (req, res) => {
  const { name, password, logout } = req.body
  if (!name && !password) {
    res.status(400)
    throw new Error('Debes enviar al menos un campo a actualizar')
  }
  if (name === '') {
    res.status(400)
    throw new Error('El nombre no debe ser vacío')
  }
  let newPassword
  if (password) {
    // Hacer el Hash al password
    const salt = await bcrypt.genSalt(10)
    newPassword = await bcrypt.hash(password, salt)
  }
  const newTokenVersion = logout === 'false' ? req.user.tokenVersion : req.user.tokenVersion + 1
  if (newPassword) {
    const userUpdated = await User.findByIdAndUpdate(req.user.id, {
      name,
      password: newPassword,
      tokenVersion: newTokenVersion
    }, { new: true })
    if (userUpdated) {
      res.status(200).json({
        _id: userUpdated.id,
        name: userUpdated.name,
        email: userUpdated.email
      })
    } else {
      res.status(400)
      throw new Error('No se pudieron guardar los datos')
    }
  } else {
    const userUpdated = await User.findByIdAndUpdate(req.user.id, {
      name
    }, { new: true })
    if (userUpdated) {
      res.status(200).json({
        _id: userUpdated.id,
        name: userUpdated.name,
        email: userUpdated.email
      })
    } else {
      res.status(400)
      throw new Error('No se pudieron guardar los datos')
    }
  }
})

const deleteUser = asyncHandler(async (req, res) => {
  const userDeleted = await User.findByIdAndUpdate(req.user.id, {
    isActive: false,
    tokenVersion: req.user.tokenVersion + 1
  },
  { new: true })
  if (userDeleted) {
    res.status(200).json({ message: 'Usuario eliminado exitosamente' })
  } else {
    res.status(400)
    throw new Error('No se ha podido eliminar el usuario')
  }
})

module.exports = {
  loginUser,
  getUser,
  updatePassword,
  updateUser,
  deleteUser
}
