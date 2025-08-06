import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

module.exports = {
  env: {
    node: true,
    es2021: true
  },
  // ...other config
};


export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
]);
