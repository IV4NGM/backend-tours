const asyncHandler = require('express-async-handler')

const TourTemplate = require('@/models/tourTemplatesModel')
const Tour = require('@/models/toursModel')

const createTemplate = asyncHandler(async (req, res) => {
  const tourTemplateData = req.body
  if (!tourTemplateData.cities || !tourTemplateData.states || !tourTemplateData.countries || !tourTemplateData.continents) {
    res.status(400)
    throw new Error('Debes ingresar todos los campos')
  }
  let duration = 1
  if (tourTemplateData.duration) {
    duration = Number(tourTemplateData.duration)
    if (isNaN(duration) || !isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) {
      res.status(400)
      throw new Error('La duración debe ser un entero positivo')
    }
  }

  const { comments, ...tourTemplateDataToCreate } = tourTemplateData

  const tourTemplateCreated = await TourTemplate.create({
    ...tourTemplateDataToCreate,
    duration,
    history: {
      user: req.user,
      action_type: 'Plantilla creada',
      description: 'Plantilla de tour creada',
      user_comments: comments
    }
  })
  if (tourTemplateCreated) {
    res.status(201).json(tourTemplateCreated)
  } else {
    res.status(400)
    throw new Error('No se ha podido crear la plantilla')
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

const getAllTours = asyncHandler(async (req, res) => {
  const templateId = req.params.id

  try {
    const template = await TourTemplate.findOne({ _id: templateId })

    if (!template || !template.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }

    const tours = await Tour.find({ tourTemplate: templateId })

    if (tours) {
      res.status(200).json(tours)
    } else {
      res.status(400)
      throw new Error('No se pudieron obtener todos los tours')
    }
  } catch (error) {
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      res.status(404)
      throw new Error('La plantilla no se encuentra en la base de datos')
    } else {
      res.status(res.statusCode || 400)
      throw new Error(error.message || 'No se pudieron obtener todos los tours')
    }
  }
})

const updateTemplate = asyncHandler(async (req, res) => {
  const templateId = req.params.id
  const templateData = req.body

  let duration
  if (templateData.duration) {
    duration = Number(templateData.duration)
    if (isNaN(duration) || !isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) {
      res.status(400)
      throw new Error('La duración debe ser un entero positivo')
    }
  }

  try {
    const template = await TourTemplate.findOne({ _id: templateId })

    if (!template || !template.isActive) {
      res.status(400)
      throw new Error('La plantilla no se encuentra en la base de datos')
    }

    const { comments, ...tourTemplateDataToUpdate } = templateData

    const updatedTemplate = await TourTemplate.findOneAndUpdate({ _id: templateId }, {
      ...tourTemplateDataToUpdate,
      duration,
      $push: {
        history: {
          user: req.user,
          action_type: 'Plantilla modificada',
          description: 'Plantilla de tour modificada',
          user_comments: comments
        }
      }
    }, { new: true })

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
    const updatedTemplate = await TourTemplate.findOneAndUpdate({ _id: templateId }, {
      isActive: false,
      $push: {
        history: {
          user: req.user,
          action_type: 'Plantilla eliminada',
          description: 'Plantilla de tour eliminada'
        }
      }
    }, { new: true })

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
  createTemplate,
  getTemplate,
  getAllTemplates,
  getAllTours,
  updateTemplate,
  deleteTemplate
}
