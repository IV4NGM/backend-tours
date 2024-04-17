const { Router } = require('express')
const router = Router()
const { createTemplate, getTemplate, getAllTemplates, getAllTours, updateTemplate, deleteTemplate } = require('@/controllers/toursControllers/tourTemplatesControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, adminProtect, createTemplate)
router.get('/:id', getTemplate)
router.get('/', getAllTemplates)
router.get('/tours/:id', getAllTours)
router.put('/:id', protect, adminProtect, updateTemplate)
router.delete('/:id', protect, adminProtect, deleteTemplate)

module.exports = router
