const checkDuplicatePromoCodes = require('./checkDuplicatePromoCodes')

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

module.exports = validateTour
