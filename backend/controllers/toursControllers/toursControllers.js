const asyncHandler = require('express-async-handler')

const TourTemplate = require('@/models/tourTemplatesModel')
const Tour = require('@/models/toursModel')

const validPromoTypes = ['2x1', 'discount', 'percentageDiscount']

const checkDuplicatePromoCodes = (promosArray) => {
  const usedCodes = []
  for (const promo of promosArray) {
    if (!promo.type || !validPromoTypes.includes(promo?.type)) {
      return ({
        isValid: false,
        message: 'Los tipos de promoción no son correctos'
      })
    }
    if (!promo.code) {
      return ({
        isValid: false,
        message: 'Todas las promociones deben tener un código'
      })
    }
    if (usedCodes.includes(promo.code)) {
      return ({
        isValid: false,
        message: 'Los códigos de las promociones deben ser distintos'
      })
    }
    usedCodes.push(promo.code)
  }
  return ({
    isValid: true,
    message: 'Los códigos de las promociones son correctos'
  })
}

const validateTour = (tourData) => {
  let minPaymentToReserve
  let priceToSet

  if (tourData.total_seats) {
    const totalSeatsNumber = Number(tourData.total_seats)
    if (isNaN(totalSeatsNumber) || !isFinite(totalSeatsNumber) || totalSeatsNumber <= 0 || !Number.isInteger(totalSeatsNumber)) {
      return ({
        isValid: false,
        message: 'La cantidad de asientos debe ser un entero positivo'
      })
    }
  }

  if (tourData.price) {
    priceToSet = Number(tourData.price)
    if (isNaN(priceToSet) || !isFinite(priceToSet) || priceToSet <= 0) {
      return ({
        isValid: false,
        message: 'El precio debe ser un número positivo'
      })
    }
  }

  if (tourData.min_payment) {
    minPaymentToReserve = Number(tourData.min_payment)
    if (isNaN(minPaymentToReserve) || !isFinite(minPaymentToReserve) || minPaymentToReserve <= 0) {
      return ({
        isValid: false,
        message: 'El precio mínimo para reservar debe ser un número positivo'
      })
    }
  }

  if (tourData.price && tourData.min_payment && minPaymentToReserve > priceToSet) {
    return ({
      isValid: false,
      message: 'El precio mínimo para reservar debe ser menor al total'
    })
  }

  // Comprobar que los códigos de promociones sean válidos
  if (tourData.promos) {
    const { isValid, message } = checkDuplicatePromoCodes(tourData.promos)
    if (!isValid) {
      return ({ isValid, message })
    }
  }

  return ({
    isValid: true,
    message: 'Los datos del tour son correctos'
  })
}

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

    const { template_id: templateId, comments, ...tourDataToCreate } = tourData
    const tourCreated = await Tour.create({
      tourTemplate,
      ...tourDataToCreate,
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

    if (!tour || !tour.isActive) {
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
  const tours = await Tour.find({ isActive: true })
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

    if (!tour || !tour.isActive) {
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

const addPromos = asyncHandler(async (req, res) => {
  const tourId = req.params.id
  const promos = req.body.promos
  const comments = req.body.comments

  if (!promos) {
    res.status(400)
    throw new Error('Debes enviar al menos una promoción')
  }
  const codes = promos.map((promo) => promo.code).join(', ')

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    let allPromos = []
    if (tour.promos) {
      allPromos = allPromos.concat(tour.promos)
    }

    allPromos = allPromos.concat(promos)

    // Validar que se ingresen promociones correctas
    const { isValid: promosAreValid, message: promosErrorMessage } = checkDuplicatePromoCodes(allPromos)
    if (!promosAreValid) {
      res.status(400)
      throw new Error(promosErrorMessage)
    }

    const updatedTour = await Tour.findOneAndUpdate({ _id: tourId }, {
      $push: {
        promos: {
          $each: promos
        },
        history: {
          user: req.user,
          action_type: 'Promociones agregadas',
          description: 'Promociones agregadas: ' + codes,
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

const editPromo = asyncHandler(async (req, res) => {
  const tourId = req.params.id
  const promo = req.body.promo
  const comments = req.body.comments

  if (!promo || !promo.code) {
    res.status(400)
    throw new Error('Debes enviar una promoción válida')
  }
  const code = promo.code

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    let allPromos = []
    if (tour.promos) {
      allPromos = allPromos.concat(tour.promos)
    }

    if (!allPromos) {
      res.status(400)
      throw new Error('No se encontraron promos por actualizar')
    }

    const currentPromoCodes = allPromos.filter((promo) => promo.isActive).map((promo) => promo.code)
    if (!currentPromoCodes.includes(code)) {
      res.status(400)
      throw new Error('No se encontró la promoción')
    }

    // Validar que se ingresen promociones correctas

    if (promo.type) {
      if (!validPromoTypes.includes(promo.type)) {
        res.status(400)
        throw new Error('Tipo de promoción no válido')
      }
    }

    allPromos = allPromos.map((originalPromo) => {
      if (originalPromo.code !== code) {
        return originalPromo
      } else {
        return {
          ...originalPromo._doc,
          ...promo
        }
      }
    })

    const updatedTour = await Tour.findOneAndUpdate({ _id: tourId }, {
      promos: allPromos,
      $push: {
        history: {
          user: req.user,
          action_type: 'Promoción editada',
          description: 'Promoción editada: ' + code,
          user_comments: comments
        }
      }
    }, { new: true })

    if (!updatedTour) {
      res.status(400)
      throw new Error('No se pudo actualizar la promoción')
    } else {
      res.status(200).json(updatedTour)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res?.statusCode || 400)
      throw new Error(error?.message || 'No se pudo actualizar la promoción')
    }
  }
})

const deletePromo = asyncHandler(async (req, res) => {
  const { id: tourId, code } = req.params

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || !tour.isActive) {
      res.status(400)
      throw new Error('El tour no se encuentra en la base de datos')
    }

    let allPromos = []
    if (tour.promos) {
      allPromos = allPromos.concat(tour.promos)
    }

    if (!allPromos) {
      res.status(400)
      throw new Error('No se encontraron promos por eliminar')
    }

    const currentPromoCodes = allPromos.filter((promo) => promo.isActive).map((promo) => promo.code)
    if (!currentPromoCodes.includes(code)) {
      res.status(400)
      throw new Error('No se encontró la promoción')
    }

    allPromos = allPromos.filter((originalPromo) => originalPromo.code !== code)

    const updatedTour = await Tour.findOneAndUpdate({ _id: tourId }, {
      promos: allPromos,
      $push: {
        history: {
          user: req.user,
          action_type: 'Promoción eliminada',
          description: 'Promoción eliminada: ' + code
        }
      }
    }, { new: true })

    if (!updatedTour) {
      res.status(400)
      throw new Error('No se pudo eliminar la promoción')
    } else {
      res.status(200).json(updatedTour)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('El tour no se encuentra en la base de datos')
    } else {
      res.status(res?.statusCode || 400)
      throw new Error(error?.message || 'No se pudo eliminar la promoción')
    }
  }
})

const deleteTour = asyncHandler(async (req, res) => {
  const tourId = req.params.id

  try {
    const tour = await Tour.findOne({ _id: tourId })

    if (!tour || !tour.isActive) {
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
  addPromos,
  editPromo,
  deletePromo,
  deleteTour
}
