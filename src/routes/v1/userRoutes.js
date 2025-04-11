const express = require('express');
const { body } = require('express-validator');
const userController = require('../../controllers/user/userController');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get all users and create new user (admin only)
router
  .route('/')
  .get(restrictTo('admin', 'manager'), userController.getAllUsers)
  .post(
    restrictTo('admin'),
    [
      body('name').notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Please provide a valid email'),
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
      body('passwordConfirm')
        .notEmpty()
        .withMessage('Password confirmation is required')
        .custom((value, { req }) => {
          if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
          }
          return true;
        }),
      body('role')
        .optional()
        .isIn(['admin', 'manager', 'employee'])
        .withMessage('Invalid role'),
    ],
    validateMiddleware,
    userController.createUser
  );

// Get current user
router.get('/me', userController.getMe, userController.getUser);

// Update current user
router.patch(
  '/updateMe',
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
  ],
  validateMiddleware,
  userController.updateMe
);

// Delete current user (set inactive)
router.delete('/deleteMe', userController.deleteMe);

// Get, update, and delete user by ID (admin only)
router
  .route('/:id')
  .get(userController.getUser)
  .patch(
    restrictTo('admin'),
    [
      body('name').optional().notEmpty().withMessage('Name cannot be empty'),
      body('email').optional().isEmail().withMessage('Please provide a valid email'),
      body('role')
        .optional()
        .isIn(['admin', 'manager', 'employee'])
        .withMessage('Invalid role'),
      body('status')
        .optional()
        .isIn(['active', 'inactive'])
        .withMessage('Invalid status'),
    ],
    validateMiddleware,
    userController.updateUser
  )
  .delete(restrictTo('admin'), userController.deleteUser);

module.exports = router;