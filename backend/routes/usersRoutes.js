const { Router } = require('express')
const router = Router()
const { loginUser, getUser, updatePassword, updateUser, deleteUser } = require('@/controllers/usersControllers/generalControllers')
const { createUser, getAllUsers } = require('@/controllers/usersControllers/adminControllers')
const { setAdmin, removeAccount } = require('@/controllers/usersControllers/managerControllers')
const { protect, adminProtect, managerProtect } = require('@/middleware/authMiddleware')

// General routes
router.post('/login', loginUser)
router.get('/', protect, getUser)
router.post('/update-password', protect, updatePassword)
router.put('/', protect, updateUser)
router.delete('/', protect, deleteUser)

// Admin routes
router.post('/', protect, adminProtect, createUser)
router.get('/all', protect, adminProtect, getAllUsers)

// Manager routes
router.post('/manager/:id', protect, adminProtect, managerProtect, setAdmin)
router.delete('/manager/:id', protect, adminProtect, managerProtect, removeAccount)

module.exports = router
