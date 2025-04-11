const express = require('express');
const { body } = require('express-validator');
const timeEntryController = require('../../controllers/timeEntry/timeEntryController');
const { protect } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get all time entries and create new time entry
router
  .route('/')
  .get(timeEntryController.getAllTimeEntries)
  .post(
    [
      body('project').notEmpty().withMessage('Project ID is required'),
      body('startTime').notEmpty().isISO8601().withMessage('Valid start time is required'),
      body('endTime').optional().isISO8601().withMessage('Invalid end time format'),
    ],
    validateMiddleware,
    timeEntryController.createTimeEntry
  );

// Get, update, and delete time entry by ID
router
  .route('/:id')
  .get(timeEntryController.getTimeEntry)
  .patch(
    [
      body('startTime').optional().isISO8601().withMessage('Invalid start time format'),
      body('endTime').optional().isISO8601().withMessage('Invalid end time format'),
    ],
    validateMiddleware,
    timeEntryController.updateTimeEntry
  )
  .delete(timeEntryController.deleteTimeEntry);

// Start timer
router.post(
  '/timer/start',
  [
    body('project').notEmpty().withMessage('Project ID is required'),
  ],
  validateMiddleware,
  timeEntryController.startTimer
);

// Stop timer
router.post('/timer/stop', timeEntryController.stopTimer);

// Get time entry statistics
router.get('/stats', timeEntryController.getTimeEntryStats);

module.exports = router;