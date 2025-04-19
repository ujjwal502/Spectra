const express = require('express');
const { body, validationResult } = require('express-validator');
const { db, utils } = require('../data/db');
const router = express.Router();

/**
 * @route   GET /api/todos
 * @desc    Get all todos
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json(db.todos);
});

/**
 * @route   GET /api/todos/:id
 * @desc    Get todo by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const todo = db.todos.find((todo) => todo.id === req.params.id);

  if (!todo) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Todo not found',
    });
  }

  res.json(todo);
});

/**
 * @route   POST /api/todos
 * @desc    Create a new todo
 * @access  Public
 */
router.post(
  '/',
  [body('title', 'Title is required').not().isEmpty(), body('completed').optional().isBoolean()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const { title, completed = false } = req.body;

    const newTodo = {
      id: utils.generateId(),
      title,
      completed: Boolean(completed),
      createdAt: utils.now(),
    };

    db.todos.push(newTodo);

    res.status(200).json(newTodo);
  },
);

/**
 * @route   PUT /api/todos/:id
 * @desc    Update a todo
 * @access  Public
 */
router.put(
  '/:id',
  [
    body('title').optional().not().isEmpty().withMessage('Title cannot be empty'),
    body('completed').optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        errors: errors.array(),
      });
    }

    const todoIndex = db.todos.findIndex((todo) => todo.id === req.params.id);

    if (todoIndex === -1) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Todo not found',
      });
    }

    const todo = db.todos[todoIndex];

    const updatedTodo = {
      ...todo,
      title: req.body.title || todo.title,
      completed: req.body.completed !== undefined ? Boolean(req.body.completed) : todo.completed,
      updatedAt: utils.now(),
    };

    db.todos[todoIndex] = updatedTodo;

    res.json(updatedTodo);
  },
);

/**
 * @route   PATCH /api/todos/:id/toggle
 * @desc    Toggle todo completion status
 * @access  Public
 */
router.patch('/:id/toggle', (req, res) => {
  const todoIndex = db.todos.findIndex((todo) => todo.id === req.params.id);

  if (todoIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Todo not found',
    });
  }

  const todo = db.todos[todoIndex];

  db.todos[todoIndex] = {
    ...todo,
    completed: !todo.completed,
    updatedAt: utils.now(),
  };

  res.json(db.todos[todoIndex]);
});

/**
 * @route   DELETE /api/todos/:id
 * @desc    Delete a todo
 * @access  Public
 */
router.delete('/:id', (req, res) => {
  const todoIndex = db.todos.findIndex((todo) => todo.id === req.params.id);

  if (todoIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Todo not found',
    });
  }

  db.todos.splice(todoIndex, 1);

  res.json({
    message: 'Todo deleted successfully',
  });
});

/**
 * @route   DELETE /api/todos/completed
 * @desc    Delete all completed todos
 * @access  Public
 */
router.delete('/completed', (req, res) => {
  const initialCount = db.todos.length;

  db.todos = db.todos.filter((todo) => !todo.completed);

  const deletedCount = initialCount - db.todos.length;

  res.json({
    message: `${deletedCount} completed todos deleted successfully`,
  });
});

/**
 * @route   PATCH /api/todos
 * @desc    Toggle all todos completion status
 * @access  Public
 */
router.patch('/', [body('completed', 'Completed flag is required').isBoolean()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      errors: errors.array(),
    });
  }

  const { completed } = req.body;

  db.todos = db.todos.map((todo) => ({
    ...todo,
    completed,
    updatedAt: utils.now(),
  }));

  res.json({
    message: `All todos marked as ${completed ? 'completed' : 'active'}`,
    todos: db.todos,
  });
});

module.exports = router;
