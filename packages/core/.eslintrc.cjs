/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: [".eslintrc.cjs"],
  extends: ["@hemicycle/eslint-config/index.js"],
  parserOptions: {
    project: true,
  },
};
