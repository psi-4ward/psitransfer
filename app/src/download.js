import "regenerator-runtime/runtime.js";

if(!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

import { createApp } from 'vue';
import { httpGet } from "./common/util";
import Download from './Download.vue';
import Icon from './common/Icon.vue'

const app = createApp({
  data() {
    return {
      baseURI: document.head.getElementsByTagName('base')[0].href.replace(/\/$/,''),
      lang: {},
    };
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

app.component('icon', Icon);
app.mount('#download');

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
