const app = require("./app")
const mongoose = require("mongoose")
const config = require("./src/config/config")
const logger = require("./src/config/logger")

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...")
  console.error(err.name, err.message, err.stack)
  process.exit(1)
})

// Connect to MongoDB
mongoose
  .connect(config.mongoURI)
  .then(() => console.log("MongoDB connection successful"))
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
})

// Handle unhandled promise rejections with improved error handling
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down...")
  console.error("Error name:", err.name)
  console.error("Error message:", err.message)
  console.error("Error stack:", err.stack)

  // Give the server time to finish current requests before shutting down
  server.close(() => {
    console.log("Server closed. Process will exit.")
    process.exit(1)
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error("Forcing process exit after timeout")
    process.exit(1)
  }, 10000)
})

// Handle SIGTERM signal
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully")
  server.close(() => {
    console.log("💥 Process terminated!")
  })
})
