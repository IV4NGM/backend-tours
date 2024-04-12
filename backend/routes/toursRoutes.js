const { Router } = require('express')
const router = Router()
const { createTour } = require('@/controllers/toursControllers/toursControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, createTour)

module.exports = router
