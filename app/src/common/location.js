"use strict";

export default {
  current() {
    let origin = document.location.origin;
    let path = document.location.pathname;

    return origin + path;
  },

  strip(count) {
    count = +count || 0;
    let origin = document.location.origin;
    let path = document.location.pathname;

    let parts = path.split('/');
    while (count-- > 0) {
      parts.pop();
    }

    return origin + parts.join('/');
  },

  tail(count) {
    count = +count || 0;
    let path = document.location.pathname;

    let parts = path.split('/');
    let result = [];
    while (count-- > 0) {
      result.push(parts.pop());
    }

    return result.join('/');
  }

};
