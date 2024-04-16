const { Router } = require('express')
const router = Router()
const { createReservation, makeDeposit, chooseSeats, makeDevolution, changeConfirmedSeats, reduceReservedSeatsAmount } = require('@/controllers/reservationsControllers/generalControllers')
const { addDiscount, reducePendingDevolution, reduceAmountPaid } = require('@/controllers/reservationsControllers/adminControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/create/:id/:phone', protect, createReservation)
router.post('/deposit/:id', protect, makeDeposit)
router.post('/seats/select/:id', protect, chooseSeats)
router.post('/seats/change/:id', protect, changeConfirmedSeats)
router.post('/seats/reduce-amount/:id', protect, reduceReservedSeatsAmount)
router.post('/devolution/:id', protect, makeDevolution)

router.post('/admin/discount/:id', protect, adminProtect, addDiscount)
router.post('/admin/reduce-devolution/:id', protect, adminProtect, reducePendingDevolution)
router.post('/admin/reduce-payment/:id', protect, adminProtect, reduceAmountPaid)

module.exports = router
