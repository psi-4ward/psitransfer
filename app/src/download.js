import "regenerator-runtime/runtime.js";

if(!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

import Vue from 'vue';
import { httpGet } from "./common/util";
import Download from './Download.vue';
import Icon from 'vue-awesome/components/Icon'

Vue.component('icon', Icon);

new Vue({
  el: '#download',
  data: {
    baseURI: document.head.getElementsByTagName('base')[0].href.replace(/\/$/,''),
    lang: {},
  },
  async beforeCreate() {
    // Fetch translations
    try {
      this.lang = await httpGet('lang.json');
    }
    catch (e) {
      alert(e);
    }
  },
  render: h => h(Download)
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
