module.exports = {
  root: true,
  extends: ['@campus-verse/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
