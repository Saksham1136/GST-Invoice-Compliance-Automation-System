const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get all users (admin only)
router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search, isActive } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter)
  ]);

  res.json({
    users: users.map(u => u.toSafeObject()),
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
  });
}));

// Update user role/status (admin only)
router.patch('/:id', authorize('admin'), [
  body('role').optional().isIn(['user', 'accountant', 'admin']),
  body('isActive').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ error: 'Validation failed', errors: errors.array() });

  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ error: 'Cannot modify your own account via this endpoint' });
  }

  const { role, isActive } = req.body;
  const updates = {};
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ message: 'User updated', user: user.toSafeObject() });
}));

// Get user stats (admin only)
router.get('/stats', authorize('admin'), asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    }
  ]);
  const total = await User.countDocuments();
  res.json({ by_role: stats, total });
}));

module.exports = router;
