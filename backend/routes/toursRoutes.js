const { Router } = require('express')
const router = Router()
const { createTour, getTour, getAllTours, getAllReservations, updateTour, addPromos, editPromo, deletePromo, cancelTour, setTourCompleted, deleteTour, getToursFormatted } = require('@/controllers/toursControllers/toursControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, createTour)
router.get('/all', getToursFormatted)
router.get('/:id', getTour)
router.get('/', getAllTours)
router.get('/reservations/:id', protect, getAllReservations)

router.put('/:id', protect, updateTour)
router.get('/cancel/:id', protect, adminProtect, cancelTour)
router.get('/complete/:id', protect, adminProtect, setTourCompleted)
router.delete('/:id', protect, adminProtect, deleteTour)

router.put('/promos/add/:id', protect, addPromos)
router.put('/promos/edit/:id', protect, editPromo)
router.delete('/promos/delete/:id/:code', protect, deletePromo)

module.exports = router
