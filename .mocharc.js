'use strict';

module.exports = {
  'forbid-only': Boolean(process.env.CI),
  spec: 'test/**/*.spec.js'
};
