const asyncHandler = require('express-async-handler')

const Tour = require('@/models/toursModel')

const deletePromo = asyncHandler(async (req, res) => {
  const { id: tourId, code } = req.params

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

module.exports = deletePromo
