const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const config = require('../config/config');
const AppError = require('../utils/appError');

// Protect routes - only authenticated users can access
exports.protect = async (req, res, next) => {
  try {
    // 1) Get token from Authorization header or cookies
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verify token
    const decoded = await promisify(jwt.verify)(token, config.jwtSecret);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Authentication failed. Please log in again.', 401));
  }
};

// Restrict routes to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// Check if user is logged in (for rendered pages, no errors)
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        config.jwtSecret
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // There is a logged in user
      req.user = currentUser;
      return next();
    }
    next();
  } catch (error) {
    next();
  }
};

// Refresh token middleware
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Find user with this refresh token
    const user = await User.findOne({ refreshToken });

    if (!user) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Verify the refresh token
    const decoded = await promisify(jwt.verify)(refreshToken, config.jwtSecret);

    // Check if user ID in token matches the user found
    if (user._id.toString() !== decoded.id) {
      return next(new AppError('Invalid refresh token', 401));
    }

    // Generate new access token
    const accessToken = jwt.sign({ id: user._id }, config.jwtSecret, {
      expiresIn: config.jwtAccessExpiresIn,
    });

    res.status(200).json({
      status: 'success',
      accessToken,
    });
  } catch (error) {
    next(new AppError('Invalid refresh token', 401));
  }
};