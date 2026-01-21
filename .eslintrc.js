module.exports = {
  root: true,
  // This tells ESLint to load the config from the package `eslint-config-custom`
  extends: ["@movement-labs/eslint-config-adapter"],
  settings: {
    next: {
      rootDir: ["apps/*/"],
    },
  },
};
