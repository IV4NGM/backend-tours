const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')

const checkDuplicatePromoCodes = require('../utils/checkDuplicatePromoCodes')

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

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
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

module.exports = addPromos
