import "regenerator-runtime/runtime.js";

if(!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

import Vue from 'vue';
import fetchLanguage from "./common/fetchLanguage";
import Download from './Download.vue';
import Icon from 'vue-awesome/components/Icon.vue'

Vue.component('icon', Icon);

new Vue({
  el: '#download',
  data: {
    baseURI: document.head.getElementsByTagName('base')[0].href,
    lang: {},
  },
  async beforeCreate() {
    // Fetch translations
    try {
      this.lang = await fetchLanguage();
    }
    catch (e) {
      alert(e);
    }
  },
  render: h => h(Download)
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
