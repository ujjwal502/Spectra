const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const router = express.Router();

/**
 * @route   GET /api/weather
 * @desc    Get all weather data
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json(db.weatherData);
});

/**
 * @route   GET /api/weather/:id
 * @desc    Get weather data by ID
 * @access  Public
 */
router.get('/:id', [param('id', 'Weather data ID is required').not().isEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      errors: errors.array(),
    });
  }

  const weatherData = db.weatherData.find((data) => data.id === req.params.id);

  if (!weatherData) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Weather data not found',
    });
  }

  res.json(weatherData);
});

/**
 * @route   GET /api/weather/city/:city
 * @desc    Get weather data by city name
 * @access  Public
 */
router.get('/city/:city', [param('city', 'City name is required').not().isEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      errors: errors.array(),
    });
  }

  const city = req.params.city.toLowerCase();
  const weatherData = db.weatherData.find((data) => data.city.toLowerCase() === city);

  if (!weatherData) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Weather data for city '${req.params.city}' not found`,
    });
  }

  res.json(weatherData);
});

/**
 * @route   GET /api/weather/delayed
 * @desc    Get all weather data with simulated delay
 * @access  Public
 */
router.get(
  '/delayed',
  [
    query('delay')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Delay must be between 1-10 seconds'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const delaySeconds = parseInt(req.query.delay || '2');

    setTimeout(() => {
      res.json({
        message: `Data returned after ${delaySeconds}s delay`,
        data: db.weatherData,
      });
    }, delaySeconds * 1000);
  },
);

/**
 * @route   GET /api/weather/error
 * @desc    Endpoint that simulates errors
 * @access  Public
 */
router.get(
  '/error',
  [
    query('code')
      .optional()
      .isInt({ min: 400, max: 599 })
      .withMessage('Error code must be between 400-599'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const errorCode = parseInt(req.query.code || '500');
    const errorMessages = {
      400: 'Bad Request - The request could not be understood',
      401: 'Unauthorized - Authentication is required',
      403: 'Forbidden - You do not have permission',
      404: 'Not Found - The requested resource does not exist',
      408: 'Request Timeout - The server timed out waiting for the request',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Something went wrong on the server',
      502: 'Bad Gateway - The server received an invalid response',
      503: 'Service Unavailable - The server is currently unavailable',
      504: 'Gateway Timeout - The server timed out waiting for a response',
    };

    const message = errorMessages[errorCode] || 'Error occurred';

    res.status(errorCode).json({
      error: message.split(' - ')[0],
      message: message.split(' - ')[1],
      code: errorCode,
    });
  },
);

/**
 * @route   GET /api/weather/random-error
 * @desc    Endpoint that randomly succeeds or fails
 * @access  Public
 */
router.get(
  '/random-error',
  [
    query('failRate')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Fail rate must be between 0 and 1'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const failRate = parseFloat(req.query.failRate || '0.5');
    const shouldFail = Math.random() < failRate;

    if (shouldFail) {
      const errorCodes = [400, 401, 403, 404, 500, 503];
      const randomErrorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];

      const errorMessages = {
        400: 'Bad Request - The request could not be understood',
        401: 'Unauthorized - Authentication is required',
        403: 'Forbidden - You do not have permission',
        404: 'Not Found - The requested resource does not exist',
        500: 'Internal Server Error - Something went wrong on the server',
        503: 'Service Unavailable - The server is currently unavailable',
      };

      const message = errorMessages[randomErrorCode];

      res.status(randomErrorCode).json({
        error: message.split(' - ')[0],
        message: message.split(' - ')[1],
        code: randomErrorCode,
        meta: {
          failRate,
          generated: true,
        },
      });
    } else {
      // Success response
      res.json({
        message: 'Request succeeded',
        data: {
          randomCities: db.weatherData.map((item) => ({
            city: item.city,
            temperature: item.temperature,
          })),
        },
        meta: {
          failRate,
          generated: false,
        },
      });
    }
  },
);

/**
 * @route   GET /api/weather/timeout
 * @desc    Endpoint that can timeout
 * @access  Public
 */
router.get(
  '/timeout',
  [query('timeout').optional().isBoolean().withMessage('Timeout must be a boolean')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const shouldTimeout = req.query.timeout === 'true';

    if (shouldTimeout) {
      // This request will never respond (simulating a timeout)
      return;
    }

    res.json({
      message: 'Request completed successfully without timeout',
      data: db.weatherData[0],
    });
  },
);

module.exports = router;
