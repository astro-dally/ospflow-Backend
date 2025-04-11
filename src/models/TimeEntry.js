const mongoose = require('mongoose');

const timeEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Time entry must belong to a user'],
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
      required: [true, 'Time entry must belong to a project'],
    },
    task: {
      type: mongoose.Schema.ObjectId,
      ref: 'Task',
    },
    description: {
      type: String,
      trim: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // Duration in minutes
      default: 0,
    },
    isBillable: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    status: {
      type: String,
      enum: ['running', 'paused', 'completed'],
      default: 'running',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculate duration when endTime is set
timeEntrySchema.pre('save', function (next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // Convert to minutes
    this.status = 'completed';
  }
  next();
});

// Index for faster queries
timeEntrySchema.index({ user: 1, startTime: -1 });
timeEntrySchema.index({ project: 1, startTime: -1 });
timeEntrySchema.index({ task: 1 });

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);

module.exports = TimeEntry;