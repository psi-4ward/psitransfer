'use strict';
const Jasmine = require('jasmine');

const jasmine = new Jasmine();
jasmine.loadConfigFile('jasmine.json');
jasmine.execute();
