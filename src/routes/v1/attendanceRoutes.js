const express = require('express');
const { body } = require('express-validator');
const attendanceController = require('../../controllers/attendance/attendanceController');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get all attendance records
router.get('/', attendanceController.getAllAttendance);

// Get attendance by ID
router.get('/:id', attendanceController.getAttendance);

// Clock in
router.post(
  '/clock-in',
  [
    body('status')
      .optional()
      .isIn(['present', 'late', 'half-day'])
      .withMessage('Invalid status'),
    body('notes').optional().isString().withMessage('Notes must be a string'),
  ],
  validateMiddleware,
  attendanceController.clockIn
);

// Clock out
router.post('/clock-out', attendanceController.clockOut);

// Start break
router.post('/break/start', attendanceController.startBreak);

// End break
router.post('/break/end', attendanceController.endBreak);

// Get attendance statistics
router.get('/stats', attendanceController.getAttendanceStats);

// Get team attendance (admin and manager only)
router.get(
  '/team',
  restrictTo('admin', 'manager'),
  attendanceController.getTeamAttendance
);

module.exports = router;