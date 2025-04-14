module.exports = {
    testEnvironment: "node",
    coveragePathIgnorePatterns: ["/node_modules/"],
    testTimeout: 10000,
    setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
    // Add transformIgnorePatterns to handle ES modules if needed
    transformIgnorePatterns: ["/node_modules/(?!emailjs)/"],
}
