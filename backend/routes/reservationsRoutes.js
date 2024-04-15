const { Router } = require('express')
const router = Router()
const { createReservation, makeDeposit } = require('@/controllers/reservationsControllers/reservationsControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/create/:id/:phone', protect, createReservation)
router.post('/deposit/:id', protect, makeDeposit)

module.exports = router
