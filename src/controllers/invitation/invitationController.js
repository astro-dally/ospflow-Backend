const Invitation = require("../../models/Invitation")
const User = require("../../models/User")
const Project = require("../../models/Project")
const AppError = require("../../utils/appError")
const catchAsync = require("../../utils/catchAsync")
const emailService = require("../../utils/email")
const config = require("../../config/config")

// Send invitation to a new user
exports.sendInvitation = catchAsync(async (req, res, next) => {
    const { email, name, role, department, projects } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        return next(new AppError("A user with this email already exists", 400))
    }

    // Check if there's a pending invitation
    const existingInvitation = await Invitation.findOne({ email, status: "pending" })
    if (existingInvitation) {
        return next(new AppError("An invitation has already been sent to this email", 400))
    }

    // Validate projects if provided
    let validatedProjects = []
    if (projects && projects.length > 0) {
        // Check if all projects exist
        const foundProjects = await Project.find({ _id: { $in: projects } })
        if (foundProjects.length !== projects.length) {
            return next(new AppError("One or more projects do not exist", 400))
        }
        validatedProjects = projects
    }

    // Create new invitation
    const invitation = await Invitation.create({
        email,
        name,
        role: role || "employee",
        department: department || "Other",
        invitedBy: req.user.id,
        projects: validatedProjects,
    })

    // Generate invitation URL
    const invitationUrl = `${config.frontendUrl}/accept-invitation/${invitation.token}`

    try {
        // Send invitation email with fallback for development
        const inviter = await User.findById(req.user.id)
        const emailResult = await emailService.sendInvitationWithFallback({ email, name }, invitationUrl, inviter.name)

        // Include email status in response
        const emailStatus = emailResult.development
            ? "Email service unavailable - invitation details logged to console"
            : "Email sent successfully"

        res.status(200).json({
            status: "success",
            message: `Invitation created successfully. ${emailStatus}`,
            data: {
                invitation: {
                    id: invitation._id,
                    email: invitation.email,
                    name: invitation.name,
                    role: invitation.role,
                    department: invitation.department,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                    token: invitation.token, // Include token in development mode for testing
                },
            },
        })
    } catch (error) {
        console.error("Failed to process invitation:", error)

        // Don't delete the invitation - keep it for manual testing
        return next(new AppError(`Invitation created but email could not be sent: ${error.message}`, 500))
    }
})

// Get all invitations (for admins and HR)
exports.getAllInvitations = catchAsync(async (req, res, next) => {
    const invitations = await Invitation.find().populate({
        path: "invitedBy",
        select: "name email",
    })

    res.status(200).json({
        status: "success",
        results: invitations.length,
        data: {
            invitations,
        },
    })
})

// Get invitation by ID
exports.getInvitation = catchAsync(async (req, res, next) => {
    const invitation = await Invitation.findById(req.params.id).populate({
        path: "invitedBy",
        select: "name email",
    })

    if (!invitation) {
        return next(new AppError("No invitation found with that ID", 404))
    }

    res.status(200).json({
        status: "success",
        data: {
            invitation,
        },
    })
})

// Resend invitation
exports.resendInvitation = catchAsync(async (req, res, next) => {
    const invitation = await Invitation.findById(req.params.id)

    if (!invitation) {
        return next(new AppError("No invitation found with that ID", 404))
    }

    if (invitation.status !== "pending") {
        return next(new AppError("This invitation is no longer pending", 400))
    }

    // Update expiration date
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    await invitation.save()

    // Generate invitation URL
    const invitationUrl = `${config.frontendUrl}/accept-invitation/${invitation.token}`

    try {
        // Send invitation email with fallback
        const inviter = await User.findById(req.user.id)
        const emailResult = await emailService.sendInvitationWithFallback(
            { email: invitation.email, name: invitation.name },
            invitationUrl,
            inviter.name,
        )

        // Include email status in response
        const emailStatus = emailResult.development
            ? "Email service unavailable - invitation details logged to console"
            : "Email sent successfully"

        res.status(200).json({
            status: "success",
            message: `Invitation resent successfully. ${emailStatus}`,
            data: {
                invitation: {
                    id: invitation._id,
                    email: invitation.email,
                    name: invitation.name,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                    token: invitation.token, // Include token in development mode for testing
                },
            },
        })
    } catch (error) {
        console.error("Failed to resend invitation:", error)
        return next(new AppError(`Failed to resend invitation email: ${error.message}`, 500))
    }
})

// Cancel invitation
exports.cancelInvitation = catchAsync(async (req, res, next) => {
    const invitation = await Invitation.findById(req.params.id)

    if (!invitation) {
        return next(new AppError("No invitation found with that ID", 404))
    }

    if (invitation.status !== "pending") {
        return next(new AppError("This invitation is no longer pending", 400))
    }

    await Invitation.findByIdAndDelete(req.params.id)

    res.status(204).json({
        status: "success",
        data: null,
    })
})

// Verify invitation token (used when user clicks the invitation link)
exports.verifyInvitation = catchAsync(async (req, res, next) => {
    const { token } = req.params

    const invitation = await Invitation.findOne({ token, status: "pending" })

    if (!invitation) {
        return next(new AppError("Invalid or expired invitation", 400))
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
        invitation.status = "expired"
        await invitation.save()
        return next(new AppError("This invitation has expired", 400))
    }

    res.status(200).json({
        status: "success",
        data: {
            invitation: {
                email: invitation.email,
                name: invitation.name,
                role: invitation.role,
                department: invitation.department,
            },
        },
    })
})

// Accept invitation and create user account
exports.acceptInvitation = catchAsync(async (req, res, next) => {
    const { token } = req.params
    const { password, passwordConfirm } = req.body

    // Find the invitation
    const invitation = await Invitation.findOne({ token, status: "pending" }).populate("projects")

    if (!invitation) {
        return next(new AppError("Invalid or expired invitation", 400))
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
        invitation.status = "expired"
        await invitation.save()
        return next(new AppError("This invitation has expired", 400))
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invitation.email })
    if (existingUser) {
        return next(new AppError("A user with this email already exists", 400))
    }

    // Create new user
    const newUser = await User.create({
        name: invitation.name,
        email: invitation.email,
        password,
        passwordConfirm,
        role: invitation.role,
        department: invitation.department,
    })

    // Add user to projects if any
    if (invitation.projects && invitation.projects.length > 0) {
        for (const project of invitation.projects) {
            await Project.findByIdAndUpdate(project._id, {
                $addToSet: { team: newUser._id },
            })
        }
    }

    // Mark invitation as accepted
    invitation.status = "accepted"
    await invitation.save()

    try {
        // Send welcome email with fallback
        const url = `${config.frontendUrl}/login`
        await emailService.sendWelcome(newUser, url)

        res.status(201).json({
            status: "success",
            message: "Account created successfully. You can now log in.",
        })
    } catch (error) {
        console.error("Welcome email error:", error)
        // Continue even if welcome email fails
        res.status(201).json({
            status: "success",
            message: "Account created successfully. You can now log in.",
        })
    }
})

// Send bulk invitations
exports.sendBulkInvitations = catchAsync(async (req, res, next) => {
    const { invitations } = req.body

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
        return next(new AppError("Please provide an array of invitations", 400))
    }

    const results = {
        successful: [],
        failed: [],
    }

    // Process each invitation
    for (const inv of invitations) {
        try {
            // Check if user already exists
            const existingUser = await User.findOne({ email: inv.email })
            if (existingUser) {
                results.failed.push({
                    email: inv.email,
                    reason: "A user with this email already exists",
                })
                continue
            }

            // Check if there's a pending invitation
            const existingInvitation = await Invitation.findOne({ email: inv.email, status: "pending" })
            if (existingInvitation) {
                results.failed.push({
                    email: inv.email,
                    reason: "An invitation has already been sent to this email",
                })
                continue
            }

            // Validate projects if provided
            let validatedProjects = []
            if (inv.projects && inv.projects.length > 0) {
                // Check if all projects exist
                const foundProjects = await Project.find({ _id: { $in: inv.projects } })
                if (foundProjects.length !== inv.projects.length) {
                    results.failed.push({
                        email: inv.email,
                        reason: "One or more projects do not exist",
                    })
                    continue
                }
                validatedProjects = inv.projects
            }

            // Create new invitation
            const invitation = await Invitation.create({
                email: inv.email,
                name: inv.name,
                role: inv.role || "employee",
                department: inv.department || "Other",
                invitedBy: req.user.id,
                projects: validatedProjects,
            })

            // Generate invitation URL
            const invitationUrl = `${config.frontendUrl}/accept-invitation/${invitation.token}`

            // Send invitation email with fallback
            const inviter = await User.findById(req.user.id)
            await emailService.sendInvitationWithFallback({ email: inv.email, name: inv.name }, invitationUrl, inviter.name)

            results.successful.push({
                id: invitation._id,
                email: invitation.email,
                name: invitation.name,
                token: invitation.token, // Include token in development mode for testing
            })
        } catch (error) {
            console.error(`Error processing invitation for ${inv.email}:`, error)
            results.failed.push({
                email: inv.email,
                reason: "Failed to process invitation: " + (error.message || "Unknown error"),
            })
        }
    }

    res.status(200).json({
        status: "success",
        message: `Successfully sent ${results.successful.length} invitations. Failed to send ${results.failed.length} invitations.`,
        data: {
            results,
        },
    })
})
