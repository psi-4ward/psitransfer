"use strict";

import 'babel-polyfill';
import Vue from 'vue';
import Upload from './Upload.vue';
import store from './Upload/store.js';

new Vue({
  el: '#upload',
  store,
  render: h => h(Upload),
  beforeCreate() {
    this.$store.dispatch('config/fetch');
  }
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
