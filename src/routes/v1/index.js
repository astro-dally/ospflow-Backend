const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const taskRoutes = require('./taskRoutes');
const timeEntryRoutes = require('./timeEntryRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const eventRoutes = require('./eventRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/events', eventRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;