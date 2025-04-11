const express = require('express');
const { body } = require('express-validator');
const projectController = require('../../controllers/project/projectController');
const { protect, restrictTo } = require('../../middleware/authMiddleware');
const validateMiddleware = require('../../middleware/validateMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get all projects and create new project
router
  .route('/')
  .get(projectController.getAllProjects)
  .post(
    [
      body('name').notEmpty().withMessage('Project name is required'),
      body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
      body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
    ],
    validateMiddleware,
    projectController.createProject
  );

// Get, update, and delete project by ID
router
  .route('/:id')
  .get(projectController.getProject)
  .patch(
    [
      body('name').optional().notEmpty().withMessage('Project name cannot be empty'),
      body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
      body('dueDate').optional().isISO8601().withMessage('Invalid due date format'),
    ],
    validateMiddleware,
    projectController.updateProject
  )
  .delete(restrictTo('admin', 'manager'), projectController.deleteProject);

// Get project statistics
router.get('/:id/stats', projectController.getProjectStats);

// Add team member to project
router.post(
  '/:id/team',
  restrictTo('admin', 'manager'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
  ],
  validateMiddleware,
  projectController.addTeamMember
);

// Remove team member from project
router.delete(
  '/:id/team/:userId',
  restrictTo('admin', 'manager'),
  projectController.removeTeamMember
);

module.exports = router;