const Project = require('../../models/Project');
const Task = require('../../models/Task');
const TimeEntry = require('../../models/TimeEntry');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const APIFeatures = require('../../utils/apiFeatures');

// Get all projects
exports.getAllProjects = catchAsync(async (req, res, next) => {
  // Execute query with features
  const features = new APIFeatures(Project.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const projects = await features.query.populate({
    path: 'manager team',
    select: 'name email avatar',
  });

  // Send response
  res.status(200).json({
    status: 'success',
    results: projects.length,
    data: {
      projects,
    },
  });
});

// Get project by ID
exports.getProject = catchAsync(async (req, res, next) => {
  const project = await Project.findById(req.params.id)
    .populate({
      path: 'manager team',
      select: 'name email avatar department role',
    })
    .populate({
      path: 'tasks',
      select: 'title status priority dueDate assignedTo',
      populate: {
        path: 'assignedTo',
        select: 'name avatar',
      },
    });

  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});

// Create new project
exports.createProject = catchAsync(async (req, res, next) => {
  // Set manager to current user if not provided
  if (!req.body.manager) {
    req.body.manager = req.user.id;
  }

  // Add current user to team if not already included
  if (!req.body.team || !req.body.team.includes(req.user.id)) {
    req.body.team = req.body.team ? [...req.body.team, req.user.id] : [req.user.id];
  }

  const newProject = await Project.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      project: newProject,
    },
  });
});

// Update project
exports.updateProject = catchAsync(async (req, res, next) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate({
    path: 'manager team',
    select: 'name email avatar',
  });

  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});

// Delete project
exports.deleteProject = catchAsync(async (req, res, next) => {
  const project = await Project.findByIdAndDelete(req.params.id);

  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Delete associated tasks and time entries
  await Task.deleteMany({ project: req.params.id });
  await TimeEntry.deleteMany({ project: req.params.id });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Get project statistics
exports.getProjectStats = catchAsync(async (req, res, next) => {
  const projectId = req.params.id;

  // Check if project exists
  const project = await Project.findById(projectId);
  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Get task statistics
  const taskStats = await Task.aggregate([
    {
      $match: { project: mongoose.Types.ObjectId(projectId) },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get time entry statistics
  const timeStats = await TimeEntry.aggregate([
    {
      $match: { project: mongoose.Types.ObjectId(projectId) },
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

  // Format task statistics
  const formattedTaskStats = {
    'To Do': 0,
    'In Progress': 0,
    'Review': 0,
    'Done': 0,
  };

  taskStats.forEach((stat) => {
    formattedTaskStats[stat._id] = stat.count;
  });

  // Format time statistics
  const timeData = timeStats.length > 0 ? timeStats[0] : { totalTime: 0, billableTime: 0, count: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      tasks: formattedTaskStats,
      time: {
        totalHours: Math.round(timeData.totalTime / 60), // Convert minutes to hours
        billableHours: Math.round(timeData.billableTime / 60),
        billablePercentage: timeData.totalTime > 0 
          ? Math.round((timeData.billableTime / timeData.totalTime) * 100) 
          : 0,
        entries: timeData.count,
      },
      progress: project.progress,
    },
  });
});

// Add team member to project
exports.addTeamMember = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  
  if (!userId) {
    return next(new AppError('User ID is required', 400));
  }

  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Check if user is already in team
  if (project.team.includes(userId)) {
    return next(new AppError('User is already in the project team', 400));
  }

  // Add user to team
  project.team.push(userId);
  await project.save();

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});

// Remove team member from project
exports.removeTeamMember = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Check if user is in team
  if (!project.team.includes(userId)) {
    return next(new AppError('User is not in the project team', 400));
  }

  // Remove user from team
  project.team = project.team.filter(id => id.toString() !== userId);
  await project.save();

  res.status(200).json({
    status: 'success',
    data: {
      project,
    },
  });
});