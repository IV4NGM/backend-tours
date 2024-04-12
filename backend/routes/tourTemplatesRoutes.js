const { Router } = require('express')
const router = Router()
const { createTemplate, getTemplate, getAllTemplates, updateTemplate, deleteTemplate } = require('@/controllers/toursControllers/tourTemplatesControllers')
const { protect, adminProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, adminProtect, createTemplate)
router.get('/:id', protect, adminProtect, getTemplate)
router.get('/', protect, adminProtect, getAllTemplates)
router.put('/:id', protect, adminProtect, updateTemplate)
router.delete('/:id', protect, adminProtect, deleteTemplate)

module.exports = router
