if(!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

import Vue from 'vue';
import Download from './Download.vue';
import Icon from 'vue-awesome/components/Icon.vue'

Vue.component('icon', Icon);

new Vue({
  el: '#download',
  render: h => h(Download)
});

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
