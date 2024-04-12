const mongoose = require('mongoose')

const tourTemplateSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor, ingresa el nombre de la plantilla']
  },
  description: {
    type: String,
    required: [true, 'Por favor, ingresa una descripción']
  },
  duration: {
    type: Number,
    required: true
  },
  main_image: {
    type: String,
    required: [true, 'Por favor, ingresa una imagen principal']
  },
  secondary_images: [String],
  cities: [String],
  states: [String],
  countries: [String],
  continents: [String],
  isInternational: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('TourTemplate', tourTemplateSchema)
