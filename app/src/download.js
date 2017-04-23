import 'babel-polyfill';
import Vue from 'vue';
import Download from './Download.vue';

new Vue({
  el: '#download',
  render: h => h(Download)
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
