const { Router } = require('express')
const router = Router()
const { createReservation, makeDeposit, chooseSeats } = require('@/controllers/reservationsControllers/reservationsControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/create/:id/:phone', protect, createReservation)
router.post('/deposit/:id', protect, makeDeposit)
router.post('/seats/select/:id', protect, chooseSeats)

module.exports = router
