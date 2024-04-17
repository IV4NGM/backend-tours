const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')
const TourTemplate = require('@/models/tourTemplatesModel')

const validateTour = require('../utils/validateTour')

const createTour = asyncHandler(async (req, res) => {
  const tourData = req.body
  if (!tourData.template_id || !tourData.starting_date || !tourData.total_seats || !tourData.price || !tourData.min_payment) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  // Validar que los datos del tour sean correctos
  const { isValid, message } = validateTour(tourData)
  if (!isValid) {
    res.status(400)
    throw new Error(message)
  }

  try {
    const tourTemplate = await TourTemplate.findOne({ _id: tourData.template_id })
    if (!tourTemplate || !tourTemplate.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }

    const { template_id: templateId, comments, blocked_seats: blockedSeats, ...tourDataToCreate } = tourData
    const totalSeatsNumbers = []
    if (!blockedSeats) {
      for (let i = 1; i <= tourDataToCreate.total_seats; i++) {
        totalSeatsNumbers.push(i)
      }
    } else {
      for (let i = 1; i <= tourDataToCreate.total_seats + blockedSeats.length; i++) {
        if (!blockedSeats.includes(i)) {
          totalSeatsNumbers.push(i)
        }
      }
    }
    const tourCreated = await Tour.create({
      tourTemplate,
      ...tourDataToCreate,
      total_seats_numbers: totalSeatsNumbers,
      confirmed_seats: [],
      reserved_seats_amount: 0,
      history: {
        user: req.user,
        action_type: 'Tour creado',
        description: 'Tour creado',
        user_comments: comments
      }
    })

    if (tourCreated) {
      res.status(200).json(tourCreated)
    } else {
      res.status(400)
      throw new Error('No se pudo crear el tour')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo crear el tour')
    }
  }
})

const getTour = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(200).json(tour)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo obtener el tour')
    }
  }
})

const getAllTours = asyncHandler(async (req, res) => {
  const tours = await Tour.find()
  if (tours) {
    res.status(200).json(tours)
  } else {
    res.status(400)
    throw new Error('No se puede mostrar la información en este momento')
  }
})

const updateTour = asyncHandler(async (req, res) => {
  const tourId = req.params.id
  const tourData = req.body

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }
    const { comments, ...tourDataToUpdate } = tourData

    const newTourData = {
      ...tour._doc,
      ...tourDataToUpdate
    }

    // Validar que los datos del tour sean correctos
    const { isValid, message } = validateTour(newTourData)
    if (!isValid) {
      res.status(400)
      throw new Error(message)
    }

    const updatedTour = await Tour.findOneAndUpdate({ _id: tourId }, {
      ...tourDataToUpdate,
      $push: {
        history: {
          user: req.user,
          action_type: 'Tour modificado',
          description: 'Tour modificado',
          user_comments: comments
        }
      }
    }, { new: true })

    if (!updatedTour) {
      res.status(400)
      throw new Error('No se pudo actualizar el tour')
    } else {
      res.status(200).json(updatedTour)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res?.statusCode || 400)
      throw new Error(error?.message || 'No se pudo actualizar el tour')
    }
  }
})

const deleteTour = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    if (tour?.status?.status_code !== 'Canceled') {
      res.status(400)
      throw new Error('No se pueden eliminar tours que no estén cancelados')
    }

    const updatedTour = await Tour.findOneAndUpdate({ _id: tourId }, {
      isActive: false,
      $push: {
        history: {
          user: req.user,
          action_type: 'Tour eliminado',
          description: 'Tour eliminado'
        }
      }
    }, { new: true })

    if (!updatedTour) {
      res.status(400)
      throw new Error('No se pudo eliminar el tour')
    } else {
      res.status(200).json({ _id: tourId })
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res?.statusCode || 400)
      throw new Error(error?.message || 'No se pudo eliminar el tour')
    }
  }
})

module.exports = {
  createTour,
  getTour,
  getAllTours,
  updateTour,
  deleteTour
}
