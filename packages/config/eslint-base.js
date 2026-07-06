// Shared flat-config ESLint base for JS/TS packages in this monorepo.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "prisma/generated/**"]
  }
];
