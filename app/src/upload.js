import "regenerator-runtime/runtime.js";

import Vue from 'vue';
import Upload from './Upload.vue';
import store from './Upload/store.js';
import Icon from 'vue-awesome/components/Icon.vue'

Vue.component('icon', Icon);

new Vue({
  el: '#upload',
  data: {
    baseURI: document.head.getElementsByTagName('base')[0].href,
    configFetched: false,
  },
  store,
  render: h => h(Upload),
  async beforeCreate() {
    try {
      await this.$store.dispatch('config/fetch');
    } catch(e) {
      if(e.code !== 'PWDREQ') {
        console.error(e);
      }
    }
    this.configFetched = true;
  }
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
