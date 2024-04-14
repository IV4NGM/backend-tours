const { Router } = require('express')
const router = Router()
const { createClient, getClient, getAllClients, updateClient, deleteClient } = require('@/controllers/clientsControllers/clientsControllers')
const { protect } = require('@/middleware/authMiddleware')

router.post('/', protect, createClient)
router.get('/:phone', protect, getClient)
router.get('/', protect, getAllClients)
router.put('/:phone', protect, updateClient)
router.delete('/:phone', protect, deleteClient)

module.exports = router
