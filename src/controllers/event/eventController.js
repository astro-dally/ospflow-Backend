const Event = require('../../models/Event');
const User = require('../../models/User');
const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const APIFeatures = require('../../utils/apiFeatures');

// Get all events
exports.getAllEvents = catchAsync(async (req, res, next) => {
  let filter = {};

  // Date range filtering
  if (req.query.startDate && req.query.endDate) {
    filter.$or = [
      {
        startDate: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        },
      },
      {
        endDate: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        },
      },
      {
        $and: [
          { startDate: { $lte: new Date(req.query.startDate) } },
          { endDate: { $gte: new Date(req.query.endDate) } },
        ],
      },
    ];
  }

  // Filter by event type
  if (req.query.type) {
    filter.type = req.query.type;
  }

  // Filter by organizer
  if (req.query.organizer) {
    filter.organizer = req.query.organizer;
  }

  // Filter by attendee
  if (req.query.attendee) {
    filter['attendees.user'] = req.query.attendee;
  } else {
    // By default, show events where the user is organizer or attendee
    filter.$or = filter.$or || [];
    filter.$or.push(
      { organizer: req.user.id },
      { 'attendees.user': req.user.id }
    );
  }

  // Execute query with features
  const features = new APIFeatures(Event.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const events = await features.query.populate([
    {
      path: 'organizer',
      select: 'name avatar',
    },
    {
      path: 'attendees.user',
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
    results: events.length,
    data: {
      events,
    },
  });
});

// Get event by ID
exports.getEvent = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id).populate([
    {
      path: 'organizer',
      select: 'name email avatar',
    },
    {
      path: 'attendees.user',
      select: 'name email avatar department',
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

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      event,
    },
  });
});

// Create new event
exports.createEvent = catchAsync(async (req, res, next) => {
  // Set organizer to current user if not provided
  if (!req.body.organizer) {
    req.body.organizer = req.user.id;
  }

  // Validate attendees if provided
  if (req.body.attendees && req.body.attendees.length > 0) {
    // Check if all attendees exist
    const attendeeIds = req.body.attendees.map(attendee => 
      typeof attendee === 'object' ? attendee.user : attendee
    );
    
    const users = await User.find({ _id: { $in: attendeeIds } });
    
    if (users.length !== attendeeIds.length) {
      return next(new AppError('One or more attendees do not exist', 400));
    }
    
    // Format attendees
    req.body.attendees = attendeeIds.map(id => ({
      user: id,
      status: 'pending',
    }));
  } else {
    req.body.attendees = [];
  }

  // Add organizer as an attendee if not already included
  const organizerIncluded = req.body.attendees.some(
    attendee => attendee.user.toString() === req.body.organizer.toString()
  );
  
  if (!organizerIncluded) {
    req.body.attendees.push({
      user: req.body.organizer,
      status: 'accepted',
    });
  }

  const newEvent = await Event.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      event: newEvent,
    },
  });
});

// Update event
exports.updateEvent = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Check if user is authorized to update this event
  if (
    event.organizer.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to update this event', 403)
    );
  }

  // Update attendees if provided
  if (req.body.attendees && req.body.attendees.length > 0) {
    // Check if all attendees exist
    const attendeeIds = req.body.attendees.map(attendee => 
      typeof attendee === 'object' ? attendee.user : attendee
    );
    
    const users = await User.find({ _id: { $in: attendeeIds } });
    
    if (users.length !== attendeeIds.length) {
      return next(new AppError('One or more attendees do not exist', 400));
    }
    
    // Format attendees
    req.body.attendees = attendeeIds.map(id => {
      // Preserve existing status for existing attendees
      const existingAttendee = event.attendees.find(
        att => att.user.toString() === id.toString()
      );
      
      return {
        user: id,
        status: existingAttendee ? existingAttendee.status : 'pending',
      };
    });
    
    // Add organizer as an attendee if not already included
    const organizerIncluded =  req.body.attendees.some(
      attendee => attendee.user.toString() === event.organizer.toString()
    );
    
    if (!organizerIncluded) {
      req.body.attendees.push({
        user: event.organizer,
        status: 'accepted',
      });
    }
  }

  const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate([
    {
      path: 'organizer',
      select: 'name avatar',
    },
    {
      path: 'attendees.user',
      select: 'name avatar',
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      event: updatedEvent,
    },
  });
});

// Delete event
exports.deleteEvent = catchAsync(async (req, res, next) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Check if user is authorized to delete this event
  if (
    event.organizer.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You do not have permission to delete this event', 403)
    );
  }

  await Event.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Update attendee status
exports.updateAttendeeStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status || !['accepted', 'declined', 'tentative'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Find the attendee
  const attendeeIndex = event.attendees.findIndex(
    att => att.user.toString() === req.user.id
  );

  if (attendeeIndex === -1) {
    return next(new AppError('You are not an attendee of this event', 404));
  }

  // Update attendee status
  event.attendees[attendeeIndex].status = status;
  await event.save();

  res.status(200).json({
    status: 'success',
    data: {
      event,
    },
  });
});