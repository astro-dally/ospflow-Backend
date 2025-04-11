const Task = require('../../models/Task');
const Project = require('../../models/Project');
const TimeEntry = require('../../models/TimeEntry');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const APIFeatures = require('../../utils/apiFeatures');

// Get all tasks
exports.getAllTasks = catchAsync(async (req, res, next) => {
  let filter = {};

  // If projectId is provided, filter tasks by project
  if (req.params.projectId) {
    filter = { project: req.params.projectId };
  }

  // If assignedTo query param is 'me', filter tasks assigned to current user
  if (req.query.assignedTo === 'me') {
    filter.assignedTo = req.user.id;
  }

  // Execute query with features
  const features = new APIFeatures(Task.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const tasks = await features.query.populate([
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'assignedTo',
      select: 'name avatar',
    },
    {
      path: 'createdBy',
      select: 'name avatar',
    },
  ]);

  // Send response
  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: {
      tasks,
    },
  });
});

// Get task by ID
exports.getTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.id).populate([
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'assignedTo',
      select: 'name email avatar department role',
    },
    {
      path: 'createdBy',
      select: 'name avatar',
    },
    {
      path: 'comments.user',
      select: 'name avatar',
    },
  ]);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// Create new task
exports.createTask = catchAsync(async (req, res, next) => {
  // Check if project exists
  const project = await Project.findById(req.body.project);
  if (!project) {
    return next(new AppError('No project found with that ID', 404));
  }

  // Set createdBy to current user
  req.body.createdBy = req.user.id;

  const newTask = await Task.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      task: newTask,
    },
  });
});

// Update task
exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate([
    {
      path: 'project',
      select: 'name',
    },
    {
      path: 'assignedTo',
      select: 'name avatar',
    },
  ]);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  // If status changed to 'Done', update project progress
  if (req.body.status === 'Done') {
    await Project.findByIdAndUpdate(task.project._id, {
      $inc: { progress: 1 },
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// Delete task
exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findByIdAndDelete(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  // Delete associated time entries
  await TimeEntry.deleteMany({ task: req.params.id });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Add subtask
exports.addSubtask = catchAsync(async (req, res, next) => {
  const { title } = req.body;

  if (!title) {
    return next(new AppError('Subtask title is required', 400));
  }

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  task.subtasks.push({ title });
  await task.save();

  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// Update subtask
exports.updateSubtask = catchAsync(async (req, res, next) => {
  const { subtaskId } = req.params;
  const { title, completed } = req.body;

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  const subtask = task.subtasks.id(subtaskId);

  if (!subtask) {
    return next(new AppError('No subtask found with that ID', 404));
  }

  if (title) subtask.title = title;
  if (completed !== undefined) {
    subtask.completed = completed;
    if (completed) {
      subtask.completedAt = Date.now();
    } else {
      subtask.completedAt = undefined;
    }
  }

  await task.save();

  res.status(200).json({
    status: 'success',
    data: {
      task,
    },
  });
});

// Delete subtask
exports.deleteSubtask = catchAsync(async (req, res, next) => {
  const { subtaskId } = req.params;

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  task.subtasks = task.subtasks.filter(
    (subtask) => subtask._id.toString() !== subtaskId
  );

  await task.save();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Add comment
exports.addComment = catchAsync(async (req, res, next) => {
  const { text } = req.body;

  if (!text) {
    return next(new AppError('Comment text is required', 400));
  }

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  task.comments.push({
    text,
    user: req.user.id,
  });

  await task.save();

  // Populate the newly added comment's user
  const populatedTask = await Task.findById(req.params.id).populate({
    path: 'comments.user',
    select: 'name avatar',
  });

  res.status(200).json({
    status: 'success',
    data: {
      comment: populatedTask.comments[populatedTask.comments.length - 1],
    },
  });
});

// Delete comment
exports.deleteComment = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new AppError('No task found with that ID', 404));
  }

  const comment = task.comments.id(commentId);

  if (!comment) {
    return next(new AppError('No comment found with that ID', 404));
  }

  // Check if user is the comment author or an admin
  if (
    comment.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to delete this comment', 403)
    );
  }

  task.comments = task.comments.filter(
    (comment) => comment._id.toString() !== commentId
  );

  await task.save();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});