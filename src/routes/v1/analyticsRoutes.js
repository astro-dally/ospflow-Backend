const express = require('express');
const analyticsController = require('../../controllers/analytics/analyticsController');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Get dashboard statistics
router.get('/dashboard', analyticsController.getDashboardStats);

// Get project analytics (admin and manager only)
router.get(
  '/projects',
  restrictTo('admin', 'manager'),
  analyticsController.getProjectAnalytics
);

// Get team performance analytics (admin and manager only)
router.get(
  '/team-performance',
  restrictTo('admin', 'manager'),
  analyticsController.getTeamPerformanceAnalytics
);

// Get resource allocation analytics (admin and manager only)
router.get(
  '/resource-allocation',
  restrictTo('admin', 'manager'),
  analyticsController.getResourceAllocationAnalytics
);

// Get performance trends analytics
router.get('/performance-trends', analyticsController.getPerformanceTrendsAnalytics);

module.exports = router;