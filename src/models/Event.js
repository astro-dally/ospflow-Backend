const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Project', 'Clock In', 'Clock Out', 'Breaks', 'Time Entries', 'Meeting', 'Deadline', 'Other'],
      default: 'Other',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
      trim: true,
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
    },
    task: {
      type: mongoose.Schema.ObjectId,
      ref: 'Task',
    },
    organizer: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Event must have an organizer'],
    },
    attendees: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'declined', 'tentative'],
          default: 'pending',
        },
      },
    ],
    color: {
      type: String,
      default: '#4CAF50', // Default green color
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrencePattern: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
      },
      interval: {
        type: Number,
        default: 1,
      },
      endDate: Date,
      daysOfWeek: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
    },
    reminders: [
      {
        time: {
          type: Number, // Minutes before event
          required: true,
        },
        sent: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for faster queries
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ 'attendees.user': 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;