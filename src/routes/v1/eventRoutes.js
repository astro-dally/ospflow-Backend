const express = require('express');
const { body } = require('express-validator');
const eventController = require('../../controllers/event/eventController');
const { protect } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get all events and create new event
router
  .route('/')
  .get(eventController.getAllEvents)
  .post(
    [
      body('title').notEmpty().withMessage('Event title is required'),
      body('startDate').notEmpty().isISO8601().withMessage('Valid start date is required'),
      body('endDate').notEmpty().isISO8601().withMessage('Valid end date is required'),
      body('type')
        .optional()
        .isIn([
          'Project',
          'Clock In',
          'Clock Out',
          'Breaks',
          'Time Entries',
          'Meeting',
          'Deadline',
          'Other',
        ])
        .withMessage('Invalid event type'),
    ],
    validateMiddleware,
    eventController.createEvent
  );

// Get, update, and delete event by ID
router
  .route('/:id')
  .get(eventController.getEvent)
  .patch(
    [
      body('title').optional().notEmpty().withMessage('Event title cannot be empty'),
      body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
      body('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    ],
    validateMiddleware,
    eventController.updateEvent
  )
  .delete(eventController.deleteEvent);

// Update attendee status
router.patch(
  '/:id/attendee-status',
  [
    body('status')
      .isIn(['accepted', 'declined', 'tentative'])
      .withMessage('Invalid status'),
  ],
  validateMiddleware,
  eventController.updateAttendeeStatus
);

module.exports = router;