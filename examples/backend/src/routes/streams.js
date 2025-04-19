const express = require('express');
const { query, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const router = express.Router();

/**
 * @route   GET /api/streams/chunked
 * @desc    Stream response in chunks
 * @access  Public
 */
router.get(
  '/chunked',
  [
    query('chunks')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Chunks must be between 1 and 20'),
    query('interval')
      .optional()
      .isInt({ min: 100, max: 5000 })
      .withMessage('Interval must be between 100ms and 5000ms'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const chunks = parseInt(req.query.chunks || '5');
    const interval = parseInt(req.query.interval || '1000');

    // Set headers for chunked response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Start with an array opening bracket
    res.write('[\n');

    let count = 0;

    // Send chunks at intervals
    const sendChunk = () => {
      count++;

      const chunk = {
        id: count,
        timestamp: new Date().toISOString(),
        data: `Chunk ${count} of ${chunks}`,
        random: Math.random(),
      };

      // Add comma for all but the last chunk
      const separator = count < chunks ? ',\n' : '\n';
      res.write(JSON.stringify(chunk, null, 2) + separator);

      if (count >= chunks) {
        // Close the array and end the response
        res.write(']');
        res.end();
      } else {
        // Schedule the next chunk
        setTimeout(sendChunk, interval);
      }
    };

    // Start sending chunks
    sendChunk();
  },
);

/**
 * @route   GET /api/streams/sse
 * @desc    Server-Sent Events endpoint
 * @access  Public
 */
router.get(
  '/sse',
  [
    query('events')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Events must be between 1 and 100'),
    query('interval')
      .optional()
      .isInt({ min: 100, max: 5000 })
      .withMessage('Interval must be between 100ms and 5000ms'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const eventCount = parseInt(req.query.events || '10');
    const interval = parseInt(req.query.interval || '1000');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection established event
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ message: 'Connection established' })}\n\n`);

    let count = 0;

    // Send events at intervals
    const sendEvent = () => {
      count++;

      // Generate random data
      const eventData = {
        id: count,
        timestamp: new Date().toISOString(),
        message: `Event ${count} of ${eventCount}`,
        data: {
          temperature: Math.round((15 + Math.random() * 15) * 10) / 10,
          humidity: Math.round((40 + Math.random() * 40) * 10) / 10,
          pressure: Math.round((980 + Math.random() * 40) * 10) / 10,
        },
      };

      // Send the event
      res.write(`id: ${count}\n`);
      res.write(`event: update\n`);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);

      // Flush the data
      res.flush?.();

      if (count >= eventCount) {
        // Send completion event
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify({ message: 'Stream complete' })}\n\n`);

        // End the connection
        res.end();
      } else {
        // Schedule the next event
        setTimeout(sendEvent, interval);
      }
    };

    // Start sending events
    sendEvent();

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from SSE');
    });
  },
);

/**
 * @route   GET /api/streams/large
 * @desc    Stream a large JSON response
 * @access  Public
 */
router.get(
  '/large',
  [
    query('size')
      .optional()
      .isInt({ min: 10, max: 10000 })
      .withMessage('Size must be between 10 and 10000'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const size = parseInt(req.query.size || '1000');

    // Set headers
    res.setHeader('Content-Type', 'application/json');

    // Stream the response
    res.write('{\n');
    res.write('  "description": "Large streamed JSON response",\n');
    res.write('  "timestamp": "' + new Date().toISOString() + '",\n');
    res.write('  "items": [\n');

    // Stream array items
    for (let i = 0; i < size; i++) {
      const item = {
        id: i + 1,
        value: `Item ${i + 1} of ${size}`,
        number: Math.round(Math.random() * 1000),
        isActive: Math.random() > 0.5,
      };

      // Add comma for all but the last item
      const separator = i < size - 1 ? ',\n' : '\n';
      res.write('    ' + JSON.stringify(item) + separator);

      // Flush every 100 items to ensure streaming
      if (i % 100 === 0) {
        res.flush?.();
      }
    }

    // Close the array and object
    res.write('  ]\n');
    res.write('}');

    // End the response
    res.end();
  },
);

/**
 * @route   GET /api/streams/countdown
 * @desc    Countdown timer as SSE
 * @access  Public
 */
router.get(
  '/countdown',
  [
    query('from')
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage('Start value must be between 1 and 60'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const startFrom = parseInt(req.query.from || '10');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let count = startFrom;

    // Send initial event
    res.write(`event: start\n`);
    res.write(`data: ${JSON.stringify({ count, message: 'Countdown started' })}\n\n`);

    // Send countdown at 1-second intervals
    const countdown = setInterval(() => {
      count--;

      res.write(`event: tick\n`);
      res.write(`data: ${JSON.stringify({ count, remaining: count })}\n\n`);

      if (count <= 0) {
        // Send completion event
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify({ message: 'Countdown complete' })}\n\n`);

        // Clear interval and end response
        clearInterval(countdown);
        res.end();
      }
    }, 1000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(countdown);
      console.log('Client disconnected from countdown');
    });
  },
);

module.exports = router;
