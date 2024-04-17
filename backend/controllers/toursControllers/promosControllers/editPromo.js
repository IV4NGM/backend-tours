const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')

const validPromoTypes = ['2x1', 'discount', 'percentageDiscount']

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

    if (!tour || (!tour.isActive && tour.status.status_code !== 'Canceled')) {
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

module.exports = editPromo
