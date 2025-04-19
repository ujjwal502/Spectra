const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks with optional filtering
 * @access  Private
 */
router.get(
  '/',
  [
    verifyToken,
    query('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    query('priority').optional().isIn(['low', 'medium', 'high']),
    query('sortBy').optional().isIn(['dueDate', 'priority', 'status', 'createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    let filteredTasks = [...db.tasks];

    // Apply filters
    if (req.query.status) {
      filteredTasks = filteredTasks.filter((task) => task.status === req.query.status);
    }

    if (req.query.priority) {
      filteredTasks = filteredTasks.filter((task) => task.priority === req.query.priority);
    }

    // Apply sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    filteredTasks.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
      }
    });

    res.json(filteredTasks);
  },
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get task by ID
 * @access  Private
 */
router.get('/:id', verifyToken, (req, res) => {
  const task = db.tasks.find((task) => task.id === req.params.id);

  if (!task) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Task not found',
    });
  }

  res.json(task);
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post(
  '/',
  [
    verifyToken,
    body('title', 'Title is required').not().isEmpty(),
    body('description').optional(),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const { title, description, status = 'pending', priority = 'medium', dueDate } = req.body;

    const newTask = {
      id: utils.generateId(),
      title,
      description: description || '',
      status,
      priority,
      dueDate: dueDate || null,
      createdAt: utils.now(),
      updatedAt: utils.now(),
    };

    db.tasks.push(newTask);

    res.status(201).json(newTask);
  },
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put(
  '/:id',
  [
    verifyToken,
    body('title').optional().not().isEmpty().withMessage('Title cannot be empty'),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    const task = db.tasks[taskIndex];

    const updatedTask = {
      ...task,
      title: req.body.title || task.title,
      description: req.body.description !== undefined ? req.body.description : task.description,
      status: req.body.status || task.status,
      priority: req.body.priority || task.priority,
      dueDate: req.body.dueDate || task.dueDate,
      updatedAt: utils.now(),
    };

    db.tasks[taskIndex] = updatedTask;

    res.json(updatedTask);
  },
);

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    Update task status
 * @access  Private
 */
router.patch(
  '/:id/status',
  [
    verifyToken,
    body('status', 'Status is required').isIn(['pending', 'in-progress', 'completed', 'cancelled']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    const task = db.tasks[taskIndex];

    db.tasks[taskIndex] = {
      ...task,
      status: req.body.status,
      updatedAt: utils.now(),
    };

    res.json(db.tasks[taskIndex]);
  },
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', verifyToken, (req, res) => {
  const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

  if (taskIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Task not found',
    });
  }

  db.tasks.splice(taskIndex, 1);

  res.json({
    message: 'Task deleted successfully',
  });
});

/**
 * @route   GET /api/tasks/due/:days
 * @desc    Get tasks due in the next X days
 * @access  Private
 */
router.get(
  '/due/:days',
  [verifyToken, param('days', 'Days must be a positive integer').isInt({ min: 1 })],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const days = parseInt(req.params.days);
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const dueTasks = db.tasks.filter((task) => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= futureDate && task.status !== 'completed';
    });

    res.json(dueTasks);
  },
);

module.exports = router;
