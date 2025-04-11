const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');

// Middleware to validate request using express-validator
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);
    return next(new AppError(`Validation error: ${errorMessages.join('. ')}`, 400));
  }
  next();
};