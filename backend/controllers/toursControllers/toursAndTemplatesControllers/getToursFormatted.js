const asyncHandler = require('express-async-handler')

const TourTemplate = require('@/models/tourTemplatesModel')
const mongoose = require('mongoose')

const getCurrentUTCDate = (date) => {
  const currentDate = new Date(date)
  const utcDate = new Date(currentDate.getTime() + currentDate.getTimezoneOffset() * 60 * 1000)
  utcDate.setUTCHours(0, 0, 0, 0)

  return utcDate
}

const getToursFormatted = asyncHandler(async (req, res) => {
  const { template_id: templateId, current_date: currentDate, deleted } = req.body

  const matchingConditions = {}
  const idMatch = {}

  if (currentDate) {
    matchingConditions.starting_date = { $gt: getCurrentUTCDate(currentDate) }
  }

  if (!deleted || deleted !== 'true') {
    matchingConditions.isActive = true
  }

  if (templateId) {
    idMatch._id = new mongoose.Types.ObjectId(templateId)
  }

  const tours = await TourTemplate.aggregate([
    {
      $match: idMatch
    },
    {
      $lookup: {
        from: 'tours',
        localField: '_id',
        foreignField: 'tourTemplate',
        pipeline: [
          {
            $match: matchingConditions
          },
          {
            $project: {
              starting_date: 1,
              additional_images: 1,
              total_seats: 1,
              reserved_seats_amount: 1,
              price: 1,
              min_payment: 1,
              promos: 1,
              isActive: 1
            }
          }
        ],
        as: 'tours'
      }
    },
    {
      $group: {
        _id: '$_id',
        tours: { $first: '$tours' },
        template_info: { $first: '$$ROOT' }
      }
    },
    {
      $project: {
        template_info: {
          history: 0,
          tours: 0
        }
      }
    }
  ])

  if (tours) {
    res.status(200).json(tours)
  } else {
    res.status(400)
    throw new Error('No se puede mostrar la información en este momento')
  }
})

module.exports = getToursFormatted
