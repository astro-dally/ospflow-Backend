const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const APIFeatures = require('../../utils/apiFeatures');

// Get all attendance records
exports.getAllAttendance = catchAsync(async (req, res, next) => {
  let filter = {};

  // If userId is provided, filter attendance by user
  if (req.query.user) {
    filter.user = req.query.user;
  } else if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    // Regular users can only see their own attendance
    filter.user = req.user.id;
  }

  // Date range filtering
  if (req.query.startDate && req.query.endDate) {
    filter.date = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
  } else if (req.query.startDate) {
    filter.date = { $gte: new Date(req.query.startDate) };
  } else if (req.query.endDate) {
    filter.date = { $lte: new Date(req.query.endDate) };
  }

  // Execute query with features
  const features = new APIFeatures(Attendance.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const attendance = await features.query.populate({
    path: 'user',
    select: 'name email avatar department',
  });

  // Send response
  res.status(200).json({
    status: 'success',
    results: attendance.length,
    data: {
      attendance,
    },
  });
});

// Get attendance by ID
exports.getAttendance = catchAsync(async (req, res, next) => {
  const attendance = await Attendance.findById(req.params.id).populate({
    path: 'user',
    select: 'name email avatar department',
  });

  if (!attendance) {
    return next(new AppError('No attendance record found with that ID', 404));
  }

  // Check if user is authorized to view this attendance record
  if (
    attendance.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin' &&
    req.user.role !== 'manager'
  ) {
    return next(
      new AppError('You do not have permission to view this attendance record', 403)
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      attendance,
    },
  });
});

// Clock in
exports.clockIn = catchAsync(async (req, res, next) => {
  // Check if user already clocked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingAttendance = await Attendance.findOne({
    user: req.user.id,
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  if (existingAttendance) {
    return next(new AppError('You have already clocked in today', 400));
  }

  // Create new attendance record
  const newAttendance = await Attendance.create({
    user: req.user.id,
    date: new Date(),
    clockInTime: new Date(),
    status: req.body.status || 'present',
    notes: req.body.notes,
  });

  res.status(201).json({
    status: 'success',
    data: {
      attendance: newAttendance,
    },
  });
});

// Clock out
exports.clockOut = catchAsync(async (req, res, next) => {
  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    user: req.user.id,
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  if (!attendance) {
    return next(new AppError('No clock-in record found for today', 404));
  }

  if (attendance.clockOutTime) {
    return next(new AppError('You have already clocked out today', 400));
  }

  // Update attendance record with clock out time
  attendance.clockOutTime = new Date();
  
  // Calculate working hours
  const workingMinutes = Math.round(
    (attendance.clockOutTime - attendance.clockInTime) / (1000 * 60)
  );
  attendance.workingHours = workingMinutes;

  // Subtract break time if any
  if (attendance.totalBreakTime) {
    attendance.workingHours -= attendance.totalBreakTime;
  }

  await attendance.save();

  res.status(200).json({
    status: 'success',
    data: {
      attendance,
    },
  });
});

// Start break
exports.startBreak = catchAsync(async (req, res, next) => {
  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    user: req.user.id,
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  if (!attendance) {
    return next(new AppError('No clock-in record found for today', 404));
  }

  if (attendance.clockOutTime) {
    return next(new AppError('You have already clocked out today', 400));
  }

  // Check if there's an ongoing break
  const ongoingBreak = attendance.breaks.find(
    (breakItem) => !breakItem.endTime
  );

  if (ongoingBreak) {
    return next(new AppError('You already have an ongoing break', 400));
  }

  // Add new break
  attendance.breaks.push({
    startTime: new Date(),
  });

  await attendance.save();

  res.status(200).json({
    status: 'success',
    data: {
      attendance,
    },
  });
});

// End break
exports.endBreak = catchAsync(async (req, res, next) => {
  // Find today's attendance record
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendance = await Attendance.findOne({
    user: req.user.id,
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  });

  if (!attendance) {
    return next(new AppError('No clock-in record found for today', 404));
  }

  // Find the ongoing break
  const ongoingBreakIndex = attendance.breaks.findIndex(
    (breakItem) => !breakItem.endTime
  );

  if (ongoingBreakIndex === -1) {
    return next(new AppError('No ongoing break found', 404));
  }

  // Update break with end time
  attendance.breaks[ongoingBreakIndex].endTime = new Date();
  
  // Calculate break duration
  const breakDuration = Math.round(
    (attendance.breaks[ongoingBreakIndex].endTime - attendance.breaks[ongoingBreakIndex].startTime) / (1000 * 60)
  );
  attendance.breaks[ongoingBreakIndex].duration = breakDuration;

  // Update total break time
  attendance.totalBreakTime = (attendance.totalBreakTime || 0) + breakDuration;

  await attendance.save();

  res.status(200).json({
    status: 'success',
    data: {
      attendance,
    },
  });
});

// Get attendance statistics
exports.getAttendanceStats = catchAsync(async (req, res, next) => {
  let filter = {};

  // If userId is provided, filter attendance by user
  if (req.query.user) {
    filter.user = req.query.user;
  } else {
    // Default to current user's attendance
    filter.user = req.user.id;
  }

  // Date range filtering
  if (req.query.startDate && req.query.endDate) {
    filter.date = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(req.query.endDate),
    };
  } else if (req.query.startDate) {
    filter.date = { $gte: new Date(req.query.startDate) };
  } else if (req.query.endDate) {
    filter.date = { $lte: new Date(req.query.endDate) };
  }

  // Get attendance statistics
  const stats = await Attendance.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        totalWorkingHours: { $sum: '$workingHours' },
        totalBreakTime: { $sum: '$totalBreakTime' },
        avgWorkingHours: { $avg: '$workingHours' },
        avgBreakTime: { $avg: '$totalBreakTime' },
      },
    },
  ]);

  // Get status breakdown
  const statusBreakdown = await Attendance.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Format statistics
  const attendanceData = stats.length > 0 
    ? stats[0] 
    : { 
        totalDays: 0, 
        totalWorkingHours: 0, 
        totalBreakTime: 0, 
        avgWorkingHours: 0, 
        avgBreakTime: 0 
      };

  // Format status breakdown
  const formattedStatusBreakdown = {
    present: 0,
    absent: 0,
    late: 0,
    'half-day': 0,
    'on-leave': 0,
  };

  statusBreakdown.forEach((status) => {
    formattedStatusBreakdown[status._id] = status.count;
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        totalDays: attendanceData.totalDays,
        totalWorkingHours: Math.round(attendanceData.totalWorkingHours / 60), // Convert minutes to hours
        totalBreakTime: Math.round(attendanceData.totalBreakTime / 60),
        avgWorkingHours: Math.round(attendanceData.avgWorkingHours / 60),
        avgBreakTime: Math.round(attendanceData.avgBreakTime / 60),
        attendanceRate: attendanceData.totalDays > 0 
          ? Math.round((formattedStatusBreakdown.present / attendanceData.totalDays) * 100) 
          : 0,
      },
      statusBreakdown: formattedStatusBreakdown,
    },
  });
});

// Get team attendance
exports.getTeamAttendance = catchAsync(async (req, res, next) => {
  // Check if user is authorized to view team attendance
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return next(
      new AppError('You do not have permission to view team attendance', 403)
    );
  }

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all users
  const users = await User.find({ active: true }).select('name avatar department role');

  // Get today's attendance for all users
  const attendance = await Attendance.find({
    date: {
      $gte: today,
      $lt: tomorrow,
    },
  }).populate({
    path: 'user',
    select: 'name avatar department role',
  });

  // Create a map of user ID to attendance status
  const attendanceMap = {};
  attendance.forEach((record) => {
    attendanceMap[record.user._id.toString()] = {
      status: record.status,
      clockInTime: record.clockInTime,
      clockOutTime: record.clockOutTime,
      workingHours: record.workingHours,
      onBreak: record.breaks.some((breakItem) => !breakItem.endTime),
    };
  });

  // Create team attendance data
  const teamAttendance = users.map((user) => {
    const userAttendance = attendanceMap[user._id.toString()] || {
      status: 'absent',
      clockInTime: null,
      clockOutTime: null,
      workingHours: 0,
      onBreak: false,
    };

    return {
      user: {
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        department: user.department,
        role: user.role,
      },
      attendance: userAttendance,
    };
  });

  res.status(200).json({
    status: 'success',
    results: teamAttendance.length,
    data: {
      teamAttendance,
    },
  });
});