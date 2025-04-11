const TimeEntry = require('../../models/TimeEntry');
const Task = require('../../models/Task');
const Project = require('../../models/Project');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const APIFeatures = require('../../utils/apiFeatures');

// Get all time entries
exports.getAllTimeEntries = catchAsync(async (req, res, next) => {
  let filter = {};

  // If userId is provided, filter time entries by user
  if (req.query.user) {
    filter.user = req.query.user;
  } else {
    // Default to current user's time entries
    filter.user = req.user.id;
  }

  // If projectId is provided, filter time entries by project
  if (req.query.project) {
    filter.project = req.query.project;
  }

  // If taskId is provided, filter time entries by task
  if (req.query.task) {
    filter.task = req.query.task;
  }

  // Date range filtering
  if (req.query.startDate && req.query.endDate) {
    filter.startTime = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
  } else if (req.query.startDate) {
    filter.startTime = { $gte: new Date(req.query.startDate) };
  } else if (req.query.endDate) {
    filter.startTime = { $lte: new Date(req.query.endDate) };
  }

  // Execute query with features
  const features = new APIFeatures(TimeEntry.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const timeEntries = await features.query.populate([
    {
      path: 'user',
      select: 'name avatar',
    },
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'task',
      select: 'title',
    },
  ]);

  // Send response
  res.status(200).json({
    status: 'success',
    results: timeEntries.length,
    data: {
      timeEntries,
    },
  });
});

// Get time entry by ID
exports.getTimeEntry = catchAsync(async (req, res, next) => {
  const timeEntry = await TimeEntry.findById(req.params.id).populate([
    {
      path: 'user',
      select:  'name avatar',
    },
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'task',
      select: 'title',
    },
  ]);

  if (!timeEntry) {
    return next(new AppError('No time entry found with that ID', 404));
  }

  // Check if user is authorized to view this time entry
  if (
    timeEntry.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin' &&
    req.user.role !== 'manager'
  ) {
    return next(
      new AppError('You do not have permission to view this time entry', 403)
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      timeEntry,
    },
  });
});

// Create new time entry
exports.createTimeEntry = catchAsync(async (req, res, next) => {
  // Set user to current user if not provided
  if (!req.body.user) {
    req.body.user = req.user.id;
  }

  // Check if project exists
  const project = await Project.findById(req.body.project);
  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Check if task exists if provided
  if (req.body.task) {
    const task = await Task.findById(req.body.task);
    if (!task) {
      return next(new AppError('No task found with that ID', 404));
    }

    // Check if task belongs to the specified project
    if (task.project.toString() !== req.body.project) {
      return next(new AppError('Task does not belong to the specified project', 400));
    }
  }

  // Calculate duration if both startTime and endTime are provided
  if (req.body.startTime && req.body.endTime) {
    const startTime = new Date(req.body.startTime);
    const endTime = new Date(req.body.endTime);
    
    if (endTime <= startTime) {
      return next(new AppError('End time must be after start time', 400));
    }
    
    req.body.duration = Math.round((endTime - startTime) / (1000 * 60)); // Convert to minutes
    req.body.status = 'completed';
  } else if (req.body.startTime) {
    req.body.status = 'running';
  }

  const newTimeEntry = await TimeEntry.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      timeEntry: newTimeEntry,
    },
  });
});

// Update time entry
exports.updateTimeEntry = catchAsync(async (req, res, next) => {
  // Find the time entry
  const timeEntry = await TimeEntry.findById(req.params.id);

  if (!timeEntry) {
    return next(new AppError('No time entry found with that ID', 404));
  }

  // Check if user is authorized to update this time entry
  if (
    timeEntry.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to update this time entry', 403)
    );
  }

  // Calculate duration if endTime is provided
  if (req.body.endTime) {
    const startTime = req.body.startTime 
      ? new Date(req.body.startTime) 
      : timeEntry.startTime;
    const endTime = new Date(req.body.endTime);
    
    if (endTime <= startTime) {
      return next(new AppError('End time must be after start time', 400));
    }
    
    req.body.duration = Math.round((endTime - startTime) / (1000 * 60)); // Convert to minutes
    req.body.status = 'completed';
  }

  // Update the time entry
  const updatedTimeEntry = await TimeEntry.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  ).populate([
    {
      path: 'user',
      select: 'name avatar',
    },
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'task',
      select: 'title',
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      timeEntry: updatedTimeEntry,
    },
  });
});

// Delete time entry
exports.deleteTimeEntry = catchAsync(async (req, res, next) => {
  const timeEntry = await TimeEntry.findById(req.params.id);

  if (!timeEntry) {
    return next(new AppError('No time entry found with that ID', 404));
  }

  // Check if user is authorized to delete this time entry
  if (
    timeEntry.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to delete this time entry', 403)
    );
  }

  await TimeEntry.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Start timer
exports.startTimer = catchAsync(async (req, res, next) => {
  // Check if there's already a running timer for this user
  const runningTimer = await TimeEntry.findOne({
    user: req.user.id,
    status: 'running',
  });

  if (runningTimer) {
    return next(new AppError('You already have a running timer', 400));
  }

  // Create a new time entry with status 'running'
  const newTimer = await TimeEntry.create({
    user: req.user.id,
    project: req.body.project,
    task: req.body.task,
    description: req.body.description,
    startTime: new Date(),
    status: 'running',
    isBillable: req.body.isBillable !== undefined ? req.body.isBillable : true,
  });

  res.status(201).json({
    status: 'success',
    data: {
      timeEntry: newTimer,
    },
  });
});

// Stop timer
exports.stopTimer = catchAsync(async (req, res, next) => {
  // Find the running timer for this user
  const runningTimer = await TimeEntry.findOne({
    user: req.user.id,
    status: 'running',
  });

  if (!runningTimer) {
    return next(new AppError('No running timer found', 404));
  }

  // Update the timer with end time and calculate duration
  const endTime = new Date();
  const duration = Math.round((endTime - runningTimer.startTime) / (1000 * 60)); // Convert to minutes

  const updatedTimer = await TimeEntry.findByIdAndUpdate(
    runningTimer._id,
    {
      endTime,
      duration,
      status: 'completed',
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      timeEntry: updatedTimer,
    },
  });
});

// Get time entry statistics
exports.getTimeEntryStats = catchAsync(async (req, res, next) => {
  let filter = {};

  // If userId is provided, filter time entries by user
  if (req.query.user) {
    filter.user = req.query.user;
  } else {
    // Default to current user's time entries
    filter.user = req.user.id;
  }

  // Date range filtering
  if (req.query.startDate && req.query.endDate) {
    filter.startTime = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
  } else if (req.query.startDate) {
    filter.startTime = { $gte: new Date(req.query.startDate) };
  } else if (req.query.endDate) {
    filter.startTime = { $lte: new Date(req.query.endDate) };
  }

  // Get time entry statistics
  const stats = await TimeEntry.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: null,
        totalTime: { $sum: '$duration' },
        billableTime: {
          $sum: {
            $cond: [{ $eq: ['$isBillable', true] }, '$duration', 0],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Get project breakdown
  const projectBreakdown = await TimeEntry.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: '$project',
        totalTime: { $sum: '$duration' },
        billableTime: {
          $sum: {
            $cond: [{ $eq: ['$isBillable', true] }, '$duration', 0],
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project',
      },
    },
    {
      $unwind: '$project',
    },
    {
      $project: {
        projectId: '$_id',
        projectName: '$project.name',
        totalTime: 1,
        billableTime: 1,
        count: 1,
      },
    },
  ]);

  // Format statistics
  const timeData = stats.length > 0 
    ? stats[0] 
    : { totalTime: 0, billableTime: 0, count: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        totalHours: Math.round(timeData.totalTime / 60), // Convert minutes to hours
        billableHours: Math.round(timeData.billableTime / 60),
        billablePercentage: timeData.totalTime > 0 
          ? Math.round((timeData.billableTime / timeData.totalTime) * 100) 
          : 0,
        entries: timeData.count,
      },
      projectBreakdown: projectBreakdown.map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        totalHours: Math.round(project.totalTime / 60),
        billableHours: Math.round(project.billableTime / 60),
        percentage: timeData.totalTime > 0 
          ? Math.round((project.totalTime / timeData.totalTime) * 100) 
          : 0,
        entries: project.count,
      })),
    },
  });
});