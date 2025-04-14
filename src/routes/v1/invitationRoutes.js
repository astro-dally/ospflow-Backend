const express = require("express")
const { body } = require("express-validator")
const invitationController = require("../../controllers/invitation/invitationController")
const { protect, restrictTo } = require("../../middleware/authMiddleware")
const validateMiddleware = require("../../middleware/validateMiddleware")

const router = express.Router()

// Protect all routes after this middleware
router.use(protect)

// Send invitation (admin and HR only)
router.post(
    "/",
    restrictTo("admin", "HR", "manager"),
    [
        body("email").isEmail().withMessage("Please provide a valid email"),
        body("name").notEmpty().withMessage("Name is required"),
        body("role").optional().isIn(["admin", "manager", "employee", "HR"]).withMessage("Invalid role"),
        body("department")
            .optional()
            .isIn(["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Other"])
            .withMessage("Invalid department"),
    ],
    validateMiddleware,
    invitationController.sendInvitation,
)

// Get all invitations (admin and HR only)
router.get("/", restrictTo("admin", "HR"), invitationController.getAllInvitations)

// Get invitation by ID
router.get("/:id", invitationController.getInvitation)

// Resend invitation
router.post("/:id/resend", restrictTo("admin", "HR", "manager"), invitationController.resendInvitation)

// Cancel invitation
router.delete("/:id", restrictTo("admin", "HR", "manager"), invitationController.cancelInvitation)

// Update the route to make verify and accept invitation routes public
// by removing the protect middleware

// Verify invitation token (public route)
router.get("/verify/:token", invitationController.verifyInvitation)

// Accept invitation and create user account (public route)
router.post(
    "/accept/:token",
    [
        body("password")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long")
            .matches(/\d/)
            .withMessage("Password must contain a number")
            .matches(/[A-Z]/)
            .withMessage("Password must contain an uppercase letter"),
        body("passwordConfirm")
            .notEmpty()
            .withMessage("Password confirmation is required")
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error("Password confirmation does not match password")
                }
                return true
            }),
    ],
    validateMiddleware,
    invitationController.acceptInvitation,
)

// Send bulk invitations (admin and HR only)
router.post(
    "/bulk",
    restrictTo("admin", "HR"),
    [
        body("invitations").isArray().withMessage("Invitations must be an array"),
        body("invitations.*.email").isEmail().withMessage("Please provide valid emails"),
        body("invitations.*.name").notEmpty().withMessage("Names are required"),
    ],
    validateMiddleware,
    invitationController.sendBulkInvitations,
)

module.exports = router
