export default {
  testEnvironment: "node",
  transform: {}, testPathIgnorePatterns: ["/node_modules/", "/tests/.*\\.e2e\\.test\\.js$"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"]
};
