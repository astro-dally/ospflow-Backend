const express = require("express")
const { body } = require("express-validator")
const invitationController = require("../../controllers/invitation/invitationController")
const validateMiddleware = require("../../middleware/validateMiddleware")

const router = express.Router()

// Public routes for invitation verification and acceptance
// These routes don't require authentication

// Verify invitation token
router.get("/verify/:token", invitationController.verifyInvitation)

// Accept invitation and create user account
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

module.exports = router
