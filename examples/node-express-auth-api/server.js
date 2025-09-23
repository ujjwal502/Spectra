'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Simple in-memory store
const users = [
  { id: 1, username: 'alice', password: 'password123', role: 'user' },
  { id: 2, username: 'bob', password: 'adminpass', role: 'admin' },
];
const todos = [
  { id: 1, title: 'First task', completed: false, ownerId: 1 },
  { id: 2, title: 'Second task', completed: true, ownerId: 1 },
];

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

// Helper: generate token
function issueToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '2h',
  });
}

// Auth middleware
function authRequired(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Public endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = issueToken(user);
  res.json({ token, token_type: 'Bearer', expires_in: 7200, user: { id: user.id, username: user.username, role: user.role } });
});

// Protected endpoints
app.get('/me', authRequired, (req, res) => {
  const user = users.find((u) => u.id === req.user.sub);
  res.json({ id: user.id, username: user.username, role: user.role });
});

app.get('/todos', authRequired, (req, res) => {
  const mine = todos.filter((t) => t.ownerId === req.user.sub);
  res.json(mine);
});

app.post('/todos', authRequired, (req, res) => {
  const { title } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ message: 'title is required' });
  }
  const id = todos.length ? Math.max(...todos.map((t) => t.id)) + 1 : 1;
  const todo = { id, title, completed: false, ownerId: req.user.sub };
  todos.push(todo);
  res.status(201).json(todo);
});

app.patch('/todos/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id && t.ownerId === req.user.sub);
  if (!todo) return res.status(404).json({ message: 'Not found' });
  if (typeof req.body.completed === 'boolean') todo.completed = req.body.completed;
  if (typeof req.body.title === 'string') todo.title = req.body.title;
  res.json(todo);
});

app.delete('/todos/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  const idx = todos.findIndex((t) => t.id === id && t.ownerId === req.user.sub);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  const [deleted] = todos.splice(idx, 1);
  res.json(deleted);
});

app.listen(PORT, () => {
  console.log(`Auth API listening on http://localhost:${PORT}`);
});


