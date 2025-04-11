const express = require('express');
const { body } = require('express-validator');
const authController = require('../../controllers/auth/authController');
const validateMiddleware = require('../../middleware/validateMiddleware');
const { authLimiter } = require('../../middleware/rateLimiter');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

// Signup route
router.post(
  '/signup',
  authLimiter,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/\d/)
      .withMessage('Password must contain a number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter'),
    body('passwordConfirm')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
  ],
  validateMiddleware,
  authController.signup
);

// Login route
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Please provide a password'),
  ],
  validateMiddleware,
  authController.login
);

// Logout route
router.get('/logout', authController.logout);

// Refresh token route
router.post(
  '/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  validateMiddleware,
  authController.refreshToken
);

// Forgot password route
router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
  ],
  validateMiddleware,
  authController.forgotPassword
);

// Reset password route
router.patch(
  '/reset-password/:token',
  [
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/\d/)
      .withMessage('Password must contain a number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter'),
    body('passwordConfirm')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
  ],
  validateMiddleware,
  authController.resetPassword
);

// Update password route (protected)
router.patch(
  '/update-password',
  protect,
  [
    body('passwordCurrent').notEmpty().withMessage('Current password is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/\d/)
      .withMessage('Password must contain a number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter'),
    body('passwordConfirm')
      .notEmpty()
      .withMessage('Password confirmation is required')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
  ],
  validateMiddleware,
  authController.updatePassword
);

module.exports = router;