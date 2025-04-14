const mongoose = require("mongoose")
const crypto = require("crypto")

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        role: {
            type: String,
            enum: ["admin", "manager", "employee", "HR"],
            default: "employee",
        },
        department: {
            type: String,
            enum: ["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Other"],
            default: "Other",
        },
        token: {
            type: String,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "declined", "expired"],
            default: "pending",
        },
        invitedBy: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: [true, "Invitation must have a sender"],
        },
        projects: [
            {
                type: mongoose.Schema.ObjectId,
                ref: "Project",
            },
        ],
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
    },
    {
        timestamps: true,
    },
)

// Generate a unique token before saving
invitationSchema.pre("save", function (next) {
    if (this.isNew) {
        this.token = crypto.randomBytes(32).toString("hex")
    }
    next()
})

// Index for faster queries
invitationSchema.index({ email: 1, status: 1 })
invitationSchema.index({ token: 1 })
invitationSchema.index({ expiresAt: 1 })

const Invitation = mongoose.model("Invitation", invitationSchema)

module.exports = Invitation
