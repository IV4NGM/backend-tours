const { createClient, getClient, getAllClients, updateClient } = require('./singleModel/singleModelControllers')
const { getAllReservations, deleteClient } = require('./dualModel/dualModelControllers')

module.exports = {
  createClient,
  getClient,
  getAllClients,
  getAllReservations,
  updateClient,
  deleteClient
}
