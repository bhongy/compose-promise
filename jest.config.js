'use strict';

module.exports = {
  roots: ['<rootDir>/examples', '<rootDir>/lib'],
  // `js` is needed for node_modules e.g. source-map/source-map.js
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/?(*.)+(test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
};
