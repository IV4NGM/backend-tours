const { Router } = require('express')
const router = Router()
const { createClient, getClient, getAllClients, getAllReservations, updateClient, deleteClient } = require('@/controllers/clientsControllers/clientsControllers')
const { protect, adminProtect, managerProtect } = require('@/middleware/authMiddleware')

router.post('/', protect, createClient)
router.get('/:phone', protect, getClient)
router.get('/', protect, adminProtect, managerProtect, getAllClients)
router.get('/reservations/:phone', protect, getAllReservations)
router.put('/:phone', protect, updateClient)
router.delete('/:phone', protect, deleteClient)

module.exports = router
