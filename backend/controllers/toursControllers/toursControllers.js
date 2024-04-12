const asyncHandler = require('express-async-handler')

const TourTemplate = require('@/models/tourTemplatesModel')
const Tour = require('@/models/toursModel')

const createTour = asyncHandler(async (req, res) => {
  const tourData = req.body
  if (!tourData.template_id || !tourData.starting_date || !tourData.total_seats || !tourData.price) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }

  const totalSeatsNumber = Number(tourData.total_seats)
  if (isNaN(totalSeatsNumber) || !isFinite(totalSeatsNumber) || totalSeatsNumber <= 0 || !Number.isInteger(totalSeatsNumber)) {
    res.status(400)
    throw new Error('La cantidad de asientos debe ser un entero positivo')
  }

  const priceToSet = Number(tourData.price)
  if (isNaN(priceToSet) || !isFinite(priceToSet) || priceToSet <= 0) {
    res.status(400)
    throw new Error('El precio debe ser un número positivo')
  }

  try {
    const tourTemplate = await TourTemplate.findOne({ _id: tourData.template_id })
    if (!tourTemplate || !tourTemplate.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }

    const { template_id: templateId, ...tourDataToCreate } = tourData
    const tourCreated = await Tour.create({
      tourTemplate,
      ...tourDataToCreate
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

const getTemplate = asyncHandler(async (req, res) => {
  const templateId = req.params.id

  try {
    const template = await TourTemplate.findOne({ _id: templateId })

    if (!template || !template.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(200).json(template)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo obtener la plantilla')
    }
  }
})

const getAllTemplates = asyncHandler(async (req, res) => {
  const templates = await TourTemplate.find({ isActive: true })
  if (templates) {
    res.status(200).json(templates)
  } else {
    res.status(400)
    throw new Error('No se puede mostrar la información en este momento')
  }
})

const updateTemplate = asyncHandler(async (req, res) => {
  const templateId = req.params.id
  const templateData = req.body

  try {
    const template = await TourTemplate.findOne({ _id: templateId })

    if (!template || !template.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }
    const updatedTemplate = await TourTemplate.findOneAndUpdate(template, templateData, { new: true })

    if (!updatedTemplate) {
      res.status(400)
      throw new Error('No se pudo actualizar la plantilla')
    } else {
      res.status(200).json(updatedTemplate)
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo actualizar la plantilla')
    }
  }
})

const deleteTemplate = asyncHandler(async (req, res) => {
  const templateId = req.params.id

  try {
    const template = await TourTemplate.findOne({ _id: templateId })

    if (!template || !template.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }
    const updatedTemplate = await TourTemplate.findOneAndUpdate(template, { isActive: false }, { new: true })

    if (!updatedTemplate) {
      res.status(400)
      throw new Error('No se pudo eliminar la plantilla')
    } else {
      res.status(200).json({ _id: templateId })
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudo eliminar la plantilla')
    }
  }
})

module.exports = {
  createTour
}
