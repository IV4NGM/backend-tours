const { Router } = require('express')
const router = Router()
const { createReservation, makeDeposit, chooseSeats, makeDevolution } = require('@/controllers/reservationsControllers/reservationsControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/create/:id/:phone', protect, createReservation)
router.post('/deposit/:id', protect, makeDeposit)
router.post('/seats/select/:id', protect, chooseSeats)
router.post('/devolution/:id', protect, adminProtect, makeDevolution)

module.exports = router
