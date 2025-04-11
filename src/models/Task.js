const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Review', 'Done'],
      default: 'To Do',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
      required: [true, 'Task must belong to a project'],
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Task must have a creator'],
    },
    dueDate: Date,
    startDate: Date,
    completedDate: Date,
    estimatedHours: Number,
    tags: [String],
    subtasks: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: Date,
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
      },
    ],
    comments: [
      {
        text: {
          type: String,
          required: true,
        },
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
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

// Virtual populate for time entries
taskSchema.virtual('timeEntries', {
  ref: 'TimeEntry',
  foreignField: 'task',
  localField: '_id',
});

// Calculate subtask completion percentage
taskSchema.virtual('subtaskProgress').get(function () {
  if (!this.subtasks || this.subtasks.length === 0) return 0;
  
  const completedSubtasks = this.subtasks.filter(subtask => subtask.completed).length;
  return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

// Pre-save middleware to update completedDate when status changes to Done
taskSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'Done' && !this.completedDate) {
    this.completedDate = Date.now();
  }
  next();
});

// Index for faster queries
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;