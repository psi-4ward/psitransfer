'use strict';
import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

import config from './store/config.js';
import upload from './store/upload.js';

export default new Vuex.Store({
  modules: {
    config,
    upload
  },

  state: {
    error: '',
    // disable all input fields
    disabled: false,
    /* States:
     * new: can modify settings and add/remove files
     * uploading: probably let user pause/cancel upload
     * uploaded: show download link
     * uploadError: show retry btn */
    state: 'new',
    lang: {}
  },

  getters: {
    error: (state, getters) => {
      return state.error || getters['upload/bucketSizeError'];
    },
    disabled: (state, getters) => {
      return !!getters.error || state.disabled;
    }
  },

  mutations: {
    ERROR(state, msg) {
      state.error = msg;
      state.disabled = true;
    },
    DISABLE(state) {
      state.disabled = true;
    },
    STATE(state, val) {
      state.state = val;
      if(val !== 'new') state.disabled = true;
    },
    LANG(state, val) {
      state.lang = val;
    }
  },
});
