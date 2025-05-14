module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      // ts-jest configuration options if needed
      // e.g., tsconfig: 'tsconfig.test.json' // if you have a separate tsconfig for tests
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};