const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Almost Done', 'Completed', 'On Hold', 'Cancelled'],
      default: 'Not Started',
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: Date,
    completedDate: Date,
    manager: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    team: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    isFavorite: {
      type: Boolean,
      default: false,
    },
    tags: [String],
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate for tasks
projectSchema.virtual('tasks', {
  ref: 'Task',
  foreignField: 'project',
  localField: '_id',
});

// Virtual populate for time entries
projectSchema.virtual('timeEntries', {
  ref: 'TimeEntry',
  foreignField: 'project',
  localField: '_id',
});

// Pre-save middleware to update progress based on tasks
projectSchema.pre('save', async function (next) {
  if (this.isNew) return next();

  try {
    const Task = mongoose.model('Task');
    const tasks = await Task.find({ project: this._id });
    
    if (tasks.length === 0) return next();
    
    const completedTasks = tasks.filter(task => task.status === 'Done').length;
    this.progress = Math.round((completedTasks / tasks.length) * 100);
    
    // Update status based on progress
    if (this.progress === 100) {
      this.status = 'Completed';
      this.completedDate = Date.now();
    } else if (this.progress >= 90) {
      this.status = 'Almost Done';
    } else if (this.progress > 0) {
      this.status = 'In Progress';
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;