const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Attendance must belong to a user'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    clockInTime: {
      type: Date,
      required: [true, 'Clock in time is required'],
    },
    clockOutTime: {
      type: Date,
    },
    workingHours: {
      type: Number, // Duration in minutes
      default: 0,
    },
    breaks: [
      {
        startTime: {
          type: Date,
          required: true,
        },
        endTime: {
          type: Date,
        },
        duration: {
          type: Number, // Duration in minutes
          default: 0,
        },
      },
    ],
    totalBreakTime: {
      type: Number, // Duration in minutes
      default: 0,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
      default: 'present',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculate working hours when clock out
attendanceSchema.pre('save', function (next) {
  // Calculate working hours if clock out time exists
  if (this.clockInTime && this.clockOutTime) {
    this.workingHours = Math.round((this.clockOutTime - this.clockInTime) / (1000 * 60)); // Convert to minutes
    
    // Subtract break time
    if (this.totalBreakTime) {
      this.workingHours -= this.totalBreakTime;
    }
  }
  
  // Calculate total break time
  if (this.breaks && this.breaks.length > 0) {
    this.totalBreakTime = this.breaks.reduce((total, breakItem) => {
      if (breakItem.startTime && breakItem.endTime) {
        breakItem.duration = Math.round((breakItem.endTime - breakItem.startTime) / (1000 * 60));
        return total + breakItem.duration;
      }
      return total;
    }, 0);
  }
  
  next();
});

// Index for faster queries
attendanceSchema.index({ user: 1, date: -1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;