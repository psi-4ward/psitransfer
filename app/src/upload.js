import "regenerator-runtime/runtime.js";

import Vue from 'vue';
import Upload from './Upload.vue';
import store from './Upload/store.js';
import Icon from 'vue-awesome/components/Icon'
import {httpGet} from "./common/util";

Vue.component('icon', Icon);

new Vue({
  el: '#upload',
  data: {
    baseURI: document.head.getElementsByTagName('base')[0].href.replace(/\/$/),
    configFetched: false,
    lang: {},
  },
  store,
  render: h => h(Upload),
  async beforeCreate() {
    // Fetch translations
    try {
      this.lang = await httpGet('lang.json');
      this.$store.commit('LANG', this.lang);
    } catch (e) {
      alert(e);
    }

    // Fetch config
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
