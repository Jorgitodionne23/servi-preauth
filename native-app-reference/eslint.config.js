// Self-contained ESLint flat config for the native-app-reference prototype.
// Kept local so linting never inherits the parent repo's ESM config.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    // The React Compiler-aware react-hooks plugin flags Reanimated shared-value
    // mutations (`sharedValue.value = ...`) as "modifying an immutable". That is
    // the intended Reanimated API, so the rule is a false positive here.
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
]);
