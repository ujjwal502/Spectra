/**
 * Simple in-memory database for testing purposes
 */
const { v4: uuidv4 } = require('uuid');

// In-memory storage
const db = {
  users: [
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123', // In a real app, this would be hashed
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      username: 'user',
      email: 'user@example.com',
      password: 'user123', // In a real app, this would be hashed
      role: 'user',
      createdAt: new Date().toISOString(),
    },
  ],

  products: [
    {
      id: '1',
      name: 'Laptop',
      description: 'High-performance laptop for professionals',
      price: 1299.99,
      category: 'Electronics',
      inStock: true,
      quantity: 50,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Smartphone',
      description: 'Latest model with advanced camera',
      price: 799.99,
      category: 'Electronics',
      inStock: true,
      quantity: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Headphones',
      description: 'Noise-cancelling wireless headphones',
      price: 249.99,
      category: 'Audio',
      inStock: true,
      quantity: 75,
      createdAt: new Date().toISOString(),
    },
  ],

  orders: [],

  tasks: [
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Draft the initial project proposal document',
      status: 'pending',
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Schedule team meeting',
      description: 'Coordinate with team members for weekly sync',
      status: 'completed',
      priority: 'medium',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],

  todos: [
    {
      id: '1',
      title: 'Buy groceries',
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Read book',
      completed: true,
      createdAt: new Date().toISOString(),
    },
  ],

  weatherData: [
    {
      id: '1',
      city: 'New York',
      country: 'US',
      temperature: 15.2,
      conditions: 'Partly Cloudy',
      humidity: 65,
      windSpeed: 8.5,
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      city: 'London',
      country: 'UK',
      temperature: 12.8,
      conditions: 'Rainy',
      humidity: 78,
      windSpeed: 6.2,
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      city: 'Tokyo',
      country: 'JP',
      temperature: 21.5,
      conditions: 'Sunny',
      humidity: 45,
      windSpeed: 4.8,
      updatedAt: new Date().toISOString(),
    },
  ],

  uploads: [],
};

/**
 * Utility functions to interact with the database
 */
const utils = {
  // Generate a unique ID
  generateId: () => uuidv4(),

  // Get current time
  now: () => new Date().toISOString(),

  // Create a deep copy of an object
  clone: (obj) => JSON.parse(JSON.stringify(obj)),
};

module.exports = {
  db,
  utils,
};
