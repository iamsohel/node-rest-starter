const bodyParser = require('body-parser')
const compression = require('compression')
const cors = require('cors')
const express = require('express')
const helmet = require('helmet')
const crossdomain = require('helmet-crossdomain')
const morgan = require('morgan')
const methodOverride = require('method-override')
const validation = require('express-validation')
const expressWinston = require('express-winston')
const httpStatus = require('http-status')

const env = require('./environment')
const logger = require('./winston')
const routes = require('../index.route')
const APIError = require('../libs/APIError')

const app = express()

/**
 * Set application port to listen to
 */
app.set('port', env.port)

/**
 * Middleware to compress respose bodies
 */
app.use(compression())

/**
 * Middleware to parese req.body data
 */
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

/**
 * Enables HTTP verbs such as PUT or DELETE in places
 * where the client doesn't support it
 */
app.use(methodOverride())

/**
 * Set morgan environment for logging
 */
if (env.nodeEnv === 'prod') {
  app.use(morgan('dev', { stream: logger.stream }))
} else if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'))
}

/**
 * Enables cross-origin resource sharing
 */
app.use(cors())

/**
 * Use helmet to secure Express headers
 */
app.use(crossdomain())
app.use(helmet.xssFilter())
app.use(helmet.noSniff())
app.use(helmet.frameguard())
app.use(helmet.ieNoOpen())
app.use(helmet.hidePoweredBy())

/**
 * Enable detailed API logging in all env except test
 */
if (env.nodeEnv !== 'test') {
  expressWinston.requestWhitelist.push('body')
  expressWinston.responseWhitelist.push('body')
  app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true, // optional: log meta data about request (defaults to true)
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
    colorStatus: true, // Color the status code (default green, 3XX cyan, 4XX yellow, 5XX red).
    colorize: true
  }))
}

/**
 * Mounts api routes at /api
 */
app.use('/api', routes)

/**
 * If error is not an instanceOf APIError, convert it.
 */
app.use((err, req, res, next) => {
  if (err instanceof validation.ValidationError) {
    // validation error contains errors which is an array of error each containing message[]
    const unifiedErrorMessage = err.errors.map(error => error.messages.join('. ')).join(' and ')
    const error = new APIError(unifiedErrorMessage, err.status, true)
    return next(error)
  } else if (!(err instanceof APIError)) {
    const apiError = new APIError(err.message, err.status, err.isPublic)
    return next(apiError)
  }
  return next(err)
})

/**
 * Catch 404 and forward to error handler
 */
app.use((req, res, next) => {
  const err = new APIError('API not found!', httpStatus.NOT_FOUND)
  return next(err)
})

/**
 * error handler, send stacktrace only during development
 */
app.use((err, req, res, next) => {
  res.status(err.status).json({
    message: err.isPublic ? err.message : httpStatus[err.status],
    stack: env.nodeEnv === 'dev' ? err.stack : {}
  })
  if (env.nodeEnv === 'dev') {
    console.error(err)
  }
})

module.exports = app
