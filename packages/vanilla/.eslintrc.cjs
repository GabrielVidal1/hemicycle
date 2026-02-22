/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: [".eslintrc.cjs", "tsdown.config.ts"],
  extends: ["@hemicycle/eslint-config/index.js"],
  parserOptions: {
    project: true,
  },
};
