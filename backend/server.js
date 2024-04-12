const express = require('express')
require('colors')
require('dotenv').config()
const cors = require('cors')
// Configurar alias
const path = require('path')
require('module-alias/register')
const aliasPath = path.join(__dirname, './')
require('module-alias').addAlias('@', aliasPath)

// Importar archivos
const connectDB = require('@/config/db')
const { errorHandler } = require('@/middleware/errorMiddleware')

// Importar rutas
const usersRoutes = require('@/routes/usersRoutes')
const tourTemplatesRoutes = require('@/routes/tourTemplatesRoutes')
const toursRoutes = require('@/routes/toursRoutes')

// Establecer puerto
const port = process.env.PORT || 5000

// Conectar a la base de datos
connectDB()

// Configurar servidor
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Usar rutas
app.use('/api/users', usersRoutes)
app.use('/api/templates', tourTemplatesRoutes)
app.use('/api/tours', toursRoutes)

// Usar middleware de manejo de errores
app.use(errorHandler)

// Iniciar servidor
app.listen(port, () => { console.log(`Servidor iniciado en el puerto ${port}`) })
