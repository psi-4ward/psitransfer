// stupid old browsers
if(typeof Promise === 'undefined') {
  (function(d, script) {
    script = d.createElement('script');
    script.type = 'text/javascript';
    script.async = false;
    script.src = '/assets/babel-polyfill.js';
    d.getElementsByTagName('head')[0].appendChild(script);
  }(document));
}
