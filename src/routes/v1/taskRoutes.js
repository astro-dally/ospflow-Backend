const express = require('express');
const { body } = require('express-validator');
const taskController = require('../../controllers/task/taskController');
const { protect } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router({ mergeParams: true });

// Protect all routes after this middleware
router.use(protect);

// Get all tasks and create new task
router
  .route('/')
  .get(taskController.getAllTasks)
  .post(
    [
      body('title').notEmpty().withMessage('Task title is required'),
      body('project').notEmpty().withMessage('Project ID is required'),
      body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
    ],
    validateMiddleware,
    taskController.createTask
  );

// Get, update, and delete task by ID
router
  .route('/:id')
  .get(taskController.getTask)
  .patch(
    [
      body('title').optional().notEmpty().withMessage('Task title cannot be empty'),
      body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
    ],
    validateMiddleware,
    taskController.updateTask
  )
  .delete(taskController.deleteTask);

// Add subtask
router.post(
  '/:id/subtasks',
  [
    body('title').notEmpty().withMessage('Subtask title is required'),
  ],
  validateMiddleware,
  taskController.addSubtask
);

// Update subtask
router.patch(
  '/:id/subtasks/:subtaskId',
  [
    body('title').optional().notEmpty().withMessage('Subtask title cannot be empty'),
    body('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  ],
  validateMiddleware,
  taskController.updateSubtask
);

// Delete subtask
router.delete('/:id/subtasks/:subtaskId', taskController.deleteSubtask);

// Add comment
router.post(
  '/:id/comments',
  [
    body('text').notEmpty().withMessage('Comment text is required'),
  ],
  validateMiddleware,
  taskController.addComment
);

// Delete comment
router.delete('/:id/comments/:commentId', taskController.deleteComment);

module.exports = router;