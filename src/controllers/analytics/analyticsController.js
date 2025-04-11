const mongoose = require('mongoose');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const TimeEntry = require('../../models/TimeEntry');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');

// Get dashboard statistics
exports.getDashboardStats = catchAsync(async (req, res, next) => {
  // Get total projects
  const totalProjects = await Project.countDocuments();
  
  // Get active tasks
  const activeTasks = await Task.countDocuments({
    status: { $ne: 'Done' },
  });
  
  // Get team members
  const teamMembers = await User.countDocuments({ active: true });
  
  // Get completion rate
  const totalTasks = await Task.countDocuments();
  const completedTasks = await Task.countDocuments({ status: 'Done' });
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Get recent projects
  const recentProjects = await Project.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('name status progress dueDate');
  
  // Get user's tasks
  const userTasks = await Task.find({ assignedTo: req.user.id, status: { $ne: 'Done' } })
    .sort({ dueDate: 1 })
    .limit(5)
    .populate({
      path: 'project',
      select: 'name',
    });
  
  // Get team activity
  const teamActivity = await Task.find({ status: 'Done' })
    .sort({ completedDate: -1 })
    .limit(5)
    .populate([
      {
        path: 'assignedTo',
        select: 'name avatar',
      },
      {
        path: 'project',
        select: 'name',
      },
    ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalProjects,
        activeTasks,
        teamMembers,
        completionRate,
      },
      recentProjects,
      userTasks,
      teamActivity,
    },
  });
});

// Get project analytics
exports.getProjectAnalytics = catchAsync(async (req, res, next) => {
  // Date range filtering
  let dateFilter = {};
  if (req.query.startDate && req.query.endDate) {
    dateFilter = {
      createdAt: {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      },
    };
  }
  
  // Get project status breakdown
  const projectStatus = await Project.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Get project progress distribution
  const projectProgress = await Project.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lte: ['$progress', 25] }, then: '0-25%' },
              { case: { $lte: ['$progress', 50] }, then: '26-50%' },
              { case: { $lte: ['$progress', 75] }, then: '51-75%' },
              { case: { $lte: ['$progress', 100] }, then: '76-100%' },
            ],
            default: 'Unknown',
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  
  // Get project completion trend (monthly)
  const projectCompletionTrend = await Project.aggregate([
    {
      $match: {
        status: 'Completed',
        completedDate: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$completedDate' },
          month: { $month: '$completedDate' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
  
  // Format project status breakdown
  const formattedProjectStatus = {
    'Not Started': 0,
    'In Progress': 0,
    'Almost Done': 0,
    'Completed': 0,
    'On Hold': 0,
    'Cancelled': 0,
  };
  
  projectStatus.forEach((status) => {
    formattedProjectStatus[status._id] = status.count;
  });
  
  // Format project progress distribution
  const formattedProjectProgress = {
    '0-25%': 0,
    '26-50%': 0,
    '51-75%': 0,
    '76-100%': 0,
  };
  
  projectProgress.forEach((progress) => {
    formattedProjectProgress[progress._id] = progress.count;
  });
  
  // Format project completion trend
  const formattedCompletionTrend = projectCompletionTrend.map((item) => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    count: item.count,
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      projectStatus: formattedProjectStatus,
      projectProgress: formattedProjectProgress,
      completionTrend: formattedCompletionTrend,
    },
  });
});

// Get team performance analytics
exports.getTeamPerformanceAnalytics = catchAsync(async (req, res, next) => {
  // Date range filtering
  let dateFilter = {};
  if (req.query.startDate && req.query.endDate) {
    dateFilter = {
      createdAt: {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      },
    };
  }
  
  // Get task completion by user
  const taskCompletionByUser = await Task.aggregate([
    {
      $match: {
        ...dateFilter,
        status: 'Done',
        assignedTo: { $exists: true },
      },
    },
    {
      $group: {
        _id: '$assignedTo',
        completedTasks: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        userId: '$_id',
        name: '$user.name',
        completedTasks: 1,
      },
    },
  ]);
  
  // Get time tracked by user
  const timeTrackedByUser = await TimeEntry.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: '$user',
        totalTime: { $sum: '$duration' },
        billableTime: {
          $sum: {
            $cond: [{ $eq: ['$isBillable', true] }, '$duration', 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        userId: '$_id',
        name: '$user.name',
        totalHours: { $round: [{ $divide: ['$totalTime', 60] }, 1] }, // Convert minutes to hours
        billableHours: { $round: [{ $divide: ['$billableTime', 60] }, 1] },
      },
    },
  ]);
  
  // Get attendance by user
  const attendanceByUser = await Attendance.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: '$user',
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
          },
        },
        totalWorkingHours: { $sum: '$workingHours' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $unwind: '$user',
    },
    {
      $project: {
        userId: '$_id',
        name: '$user.name',
        attendanceRate: {
          $cond: [
            { $gt: ['$totalDays', 0] },
            { $round: [{ $multiply: [{ $divide: ['$presentDays', '$totalDays'] }, 100] }, 1] },
            0,
          ],
        },
        avgWorkingHours: {
          $cond: [
            { $gt: ['$totalDays', 0] },
            { $round: [{ $divide: [{ $divide: ['$totalWorkingHours', '$totalDays'] }, 60] }, 1] },
            0,
          ],
        },
      },
    },
  ]);
  
  // Combine data for team performance
  const users = await User.find({ active: true }).select('name department role');
  
  const teamPerformance = users.map((user) => {
    const taskData = taskCompletionByUser.find(
      (item) => item.userId.toString() === user._id.toString()
    ) || { completedTasks: 0 };
    
    const timeData = timeTrackedByUser.find(
      (item) => item.userId.toString() === user._id.toString()
    ) || { totalHours: 0, billableHours: 0 };
    
    const attendanceData = attendanceByUser.find(
      (item) => item.userId.toString() === user._id.toString()
    ) || { attendanceRate: 0, avgWorkingHours: 0 };
    
    return {
      userId: user._id,
      name: user.name,
      department: user.department,
      role: user.role,
      completedTasks: taskData.completedTasks,
      totalHours: timeData.totalHours,
      billableHours: timeData.billableHours,
      attendanceRate: attendanceData.attendanceRate,
      avgWorkingHours: attendanceData.avgWorkingHours,
    };
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      teamPerformance,
    },
  });
});

// Get resource allocation analytics
exports.getResourceAllocationAnalytics = catchAsync(async (req, res, next) => {
  // Date range filtering
  let dateFilter = {};
  if (req.query.startDate && req.query.endDate) {
    dateFilter = {
      startTime: {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      },
    };
  }
  
  // Get time allocation by department
  const timeByDepartment = await TimeEntry.aggregate([
    {
      $match: dateFilter,
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userData',
      },
    },
    {
      $unwind: '$userData',
    },
    {
      $group: {
        _id: '$userData.department',
        totalTime: { $sum: '$duration' },
      },
    },
    {
      $project: {
        department: '$_id',
        totalHours: { $round: [{ $divide: ['$totalTime', 60] }, 1] }, // Convert minutes to hours
      },
    },
  ]);
  
  // Get time allocation by project
  const timeByProject = await TimeEntry.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: '$project',
        totalTime: { $sum: '$duration' },
      },
    },
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'projectData',
      },
    },
    {
      $unwind: '$projectData',
    },
    {
      $project: {
        projectId: '$_id',
        projectName: '$projectData.name',
        totalHours: { $round: [{ $divide: ['$totalTime', 60] }, 1] }, // Convert minutes to hours
      },
    },
    {
      $sort: { totalHours: -1 },
    },
    {
      $limit: 10, // Top 10 projects
    },
  ]);
  
  // Get user utilization
  const userUtilization = await TimeEntry.aggregate([
    {
      $match: dateFilter,
    },
    {
      $group: {
        _id: '$user',
        totalTime: { $sum: '$duration' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userData',
      },
    },
    {
      $unwind: '$userData',
    },
    {
      $lookup: {
        from: 'attendances',
        let: { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user', '$$userId'] },
                  dateFilter.startTime ? { $gte: ['$date', dateFilter.startTime.$gte] } : { $eq: [1, 1] },
                  dateFilter.startTime ? { $lte: ['$date', dateFilter.startTime.$lte] } : { $eq: [1, 1] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalWorkingHours: { $sum: '$workingHours' },
            },
          },
        ],
        as: 'attendanceData',
      },
    },
    {
      $project: {
        userId: '$_id',
        name: '$userData.name',
        department: '$userData.department',
        trackedHours: { $round: [{ $divide: ['$totalTime', 60] }, 1] }, // Convert minutes to hours
        workingHours: {
          $cond: {
            if: { $gt: [{ $size: '$attendanceData' }, 0] },
            then: { $round: [{ $divide: [{ $arrayElemAt: ['$attendanceData.totalWorkingHours', 0] }, 60] }, 1] },
            else: 0,
          },
        },
      },
    },
    {
      $project: {
        userId: 1,
        name: 1,
        department: 1,
        trackedHours: 1,
        workingHours: 1,
        utilizationRate: {
          $cond: {
            if: { $gt: ['$workingHours', 0] },
            then: { $round: [{ $multiply: [{ $divide: ['$trackedHours', '$workingHours'] }, 100] }, 1] },
            else: 0,
          },
        },
      },
    },
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      timeByDepartment,
      timeByProject,
      userUtilization,
    },
  });
});

// Get performance trends analytics
exports.getPerformanceTrendsAnalytics = catchAsync(async (req, res, next) => {
  // Get productivity trend (tasks completed per month)
  const productivityTrend = await Task.aggregate([
    {
      $match: {
        status: 'Done',
        completedDate: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$completedDate' },
          month: { $month: '$completedDate' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
  
  // Get budget trend (billable hours per month)
  const budgetTrend = await TimeEntry.aggregate([
    {
      $match: {
        isBillable: true,
        endTime: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$endTime' },
          month: { $month: '$endTime' },
        },
        totalHours: { $sum: { $divide: ['$duration', 60] } }, // Convert minutes to hours
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
  
  // Get quality trend (tasks that moved from Review to Done vs Review to In Progress)
  const qualityTrend = await Task.aggregate([
    {
      $match: {
        $or: [
          { status: 'Done' },
          { status: 'In Progress' },
        ],
        updatedAt: { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$updatedAt' },
          month: { $month: '$updatedAt' },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
  
  // Get timeline trend (average task completion time per month)
  const timelineTrend = await Task.aggregate([
    {
      $match: {
        status: 'Done',
        startDate: { $exists: true },
        completedDate: { $exists: true },
      },
    },
    {
      $project: {
        completionMonth: {
          year: { $year: '$completedDate' },
          month: { $month: '$completedDate' },
        },
        completionTime: {
          $divide: [
            { $subtract: ['$completedDate', '$startDate'] },
            1000 * 60 * 60 * 24, // Convert to days
          ],
        },
      },
    },
    {
      $group: {
        _id: '$completionMonth',
        avgCompletionTime: { $avg: '$completionTime' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
  
  // Format productivity trend
  const formattedProductivityTrend = productivityTrend.map((item) => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    value: item.count,
  }));
  
  // Format budget trend
  const formattedBudgetTrend = budgetTrend.map((item) => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    value: Math.round(item.totalHours),
  }));
  
  // Format quality trend
  const qualityData = {};
  qualityTrend.forEach((item) => {
    const date = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`;
    if (!qualityData[date]) {
      qualityData[date] = { done: 0, inProgress: 0 };
    }
    
    if (item._id.status === 'Done') {
      qualityData[date].done = item.count;
    } else if (item._id.status === 'In Progress') {
      qualityData[date].inProgress = item.count;
    }
  });
  
  const formattedQualityTrend = Object.keys(qualityData).map((date) => {
    const total = qualityData[date].done + qualityData[date].inProgress;
    const qualityRate = total > 0 
      ? Math.round((qualityData[date].done / total) * 100) 
      : 0;
    
    return {
      date,
      value: qualityRate,
    };
  });
  
  // Format timeline trend
  const formattedTimelineTrend = timelineTrend.map((item) => ({
    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    value: Math.round(item.avgCompletionTime * 10) / 10, // Round to 1 decimal place
  }));
  
  res.status(200).json({
    status: 'success',
    data: {
      productivity: formattedProductivityTrend,
      budget: formattedBudgetTrend,
      quality: formattedQualityTrend,
      timeline: formattedTimelineTrend,
    },
  });
});