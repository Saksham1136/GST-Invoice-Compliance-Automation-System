const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

// Signup
router.post('/signup', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  // body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  //   .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  
  body('role').optional().isIn(['user', 'accountant', 'admin']).withMessage('Invalid role'),
  body('company').optional().trim().isLength({ max: 100 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { name, email, password, role = 'user', company, gstin } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = await User.create({ name, email, password, role, company, gstin });
  const { accessToken, refreshToken } = generateTokens(user._id);

  await User.findByIdAndUpdate(user._id, { refreshToken });

  logger.info(`New user registered: ${email}, role: ${role}`);

  res.status(201).json({
    message: 'Account created successfully',
    user: user.toSafeObject(),
    accessToken,
    refreshToken
  });
}));

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshToken +loginAttempts +lockUntil');
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.isLocked) {
    return res.status(423).json({ error: 'Account locked due to multiple failed attempts. Try again in 2 hours.' });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: 'Account has been deactivated' });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await user.incLoginAttempts();
    const attemptsLeft = Math.max(0, 5 - (user.loginAttempts + 1));
    return res.status(401).json({
      error: 'Invalid email or password',
      ...(attemptsLeft > 0 && { attempts_left: attemptsLeft })
    });
  }

  await user.resetLoginAttempts();
  const { accessToken, refreshToken } = generateTokens(user._id);
  await User.findByIdAndUpdate(user._id, { refreshToken });

  logger.info(`User logged in: ${email}`);

  res.json({
    message: 'Login successful',
    user: user.toSafeObject(),
    accessToken,
    refreshToken
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production'
    );
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(decoded.userId).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokens = generateTokens(user._id);
  await User.findByIdAndUpdate(user._id, { refreshToken: tokens.refreshToken });

  res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ user: user.toSafeObject() });
}));

// Update profile
router.patch('/profile', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('company').optional().trim().isLength({ max: 100 }),
  body('gstin').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Invalid GSTIN')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', errors: errors.array() });
  }

  const { name, company, gstin } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (company !== undefined) updates.company = company;
  if (gstin !== undefined) updates.gstin = gstin;

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ message: 'Profile updated', user: user.toSafeObject() });
}));

// Logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ message: 'Logged out successfully' });
}));

module.exports = router;
