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

module.exports = checkDuplicatePromoCodes
