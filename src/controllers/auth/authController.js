const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const config = require('../../config/config');
const Email = require('../../utils/email');

// Create token
const signToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiresIn,
  });
};

// Create refresh token
const createRefreshToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  });
};

// Send tokens
const createSendTokens = (user, statusCode, req, res) => {
  // Create tokens
  const accessToken = signToken(user._id);
  const refreshToken = createRefreshToken(user._id);

  // Save refresh token to user
  user.refreshToken = refreshToken;
  user.save({ validateBeforeSave: false });

  // Set JWT cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  };

  // Set cookie
  res.cookie('jwt', accessToken, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    accessToken,
    refreshToken,
    data: {
      user,
    },
  });
};

// Register new user
exports.signup = catchAsync(async (req, res, next) => {
  // Create new user
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role || 'employee',
    department: req.body.department,
    phone: req.body.phone,
  });

  // Send welcome email
  const url = `${config.frontendUrl}/login`;
  await new Email(newUser, url).sendWelcome();

  // Send tokens
  createSendTokens(newUser, 201, req, res);
});

// Login user
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // Send tokens
  createSendTokens(user, 200, req, res);
});

// Logout user
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

// Refresh token
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  // Verify token
  const decoded = jwt.verify(refreshToken, config.jwtSecret);

  // Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('The user no longer exists.', 401));
  }

  // Check if refresh token matches
  if (user.refreshToken !== refreshToken) {
    return next(new AppError('Invalid refresh token', 401));
  }

  // Generate new tokens
  createSendTokens(user, 200, req, res);
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }

  // Generate random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // Send it to user's email
    const resetURL = `${config.frontendUrl}/reset-password/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!', 500)
    );
  }
});

// Reset password
exports.resetPassword = catchAsync(async (req, res, next) => {
  // Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Update changedPasswordAt property for the user
  // This is handled by a pre-save middleware in the User model

  // Log the user in, send JWT
  createSendTokens(user, 200, req, res);
});

// Update password
exports.updatePassword = catchAsync(async (req, res, next) => {
  // Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // Log user in, send JWT
  createSendTokens(user, 200, req, res);
});