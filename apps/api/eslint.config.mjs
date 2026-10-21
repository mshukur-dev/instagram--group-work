import base from '@instagram/config/eslint/base';

export default [
  { ignores: ['**/*.config.js'] },
  ...base,
  {
    // Nest modules are empty classes decorated with @Module
    rules: { '@typescript-eslint/no-extraneous-class': 'off' },
  },
];
