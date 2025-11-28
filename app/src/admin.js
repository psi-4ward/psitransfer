import { createApp } from 'vue';
import Admin from './Admin.vue';
import Icon from './common/Icon.vue'

function parseDate(str) {
  if(!str) return str;
  return new Date(str);
}

function formatDate(dt) {
  if(dt === null) return "";
  const f = function(d) {
    return d < 10 ? '0' + d : d;
  };
  return dt.getFullYear() + '-' + f(dt.getMonth() + 1) + '-' + f(dt.getDate()) + ' ' + f(dt.getHours()) + ':' + f(dt.getMinutes());
}
function isDate(d) {
  return Object.prototype.toString.call(d) === '[object Date]';
}

function dateFilter(val, format) {
  if(!isDate(val)) {
    val = parseDate(val);
  }
  return isDate(val) ? formatDate(val, format) : val;
}

const app = createApp({
  data() {
    return {
      baseURI: document.head.getElementsByTagName('base')[0].href
    };
  },
  render: h => h(Admin)
});

app.config.globalProperties.$filters = { date: dateFilter };
app.component('icon', Icon);
app.mount('#admin');

window.PSITRANSFER_VERSION = PSITRANSFER_VERSION;
