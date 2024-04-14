const { Router } = require('express')
const router = Router()
// const { createTour, getTour, getAllTours, updateTour, addPromos, editPromo, deletePromo, deleteTour } = require('@/controllers/toursControllers/toursControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

module.exports = router
