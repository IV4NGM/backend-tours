const { Router } = require('express')
const router = Router()
const { createTour, getTour, getAllTours, updateTour, addPromos, editPromo, deletePromo, deleteTour } = require('@/controllers/toursControllers/toursControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, createTour)
router.get('/:id', getTour)
router.get('/', getAllTours)

router.put('/:id', protect, updateTour)
router.delete('/:id', protect, adminProtect, deleteTour)

router.put('/promos/add/:id', protect, addPromos)
router.put('/promos/edit/:id', protect, editPromo)
router.delete('/promos/delete/:id/:code', protect, deletePromo)

module.exports = router
