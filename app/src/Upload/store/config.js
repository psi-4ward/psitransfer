'use strict';
import Vue from 'vue';

export default {
  namespaced: true,

  state: {},

  mutations: {
    SET(state, val) {
      for (let k in val) {
        Vue.set(state, k, val[k]);
      }
    }
  },

  actions: {
    fetch({commit, }) {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/config.json');
      xhr.onload = () => {
        if(xhr.status === 200) {
          try {
            const conf = JSON.parse(xhr.responseText);
            commit('SET', conf);
            commit('upload/RETENTION', conf.defaultRetention, {root:true});
            commit('upload/CHUNK_SIZE_IN_MB', conf.chunkSizeInMb, {root:true});
            commit('upload/ALLOW_USER_CONFIG_CHUNK_SIZE', conf.allowUserConfigChunkSize, {root:true})
          }
          catch(e) {
            commit('ERROR', `Config parse Error: ${e.message}`, {root: true});
          }
        }
        else {
          commit('ERROR', `Config load error: ${xhr.status} ${xhr.statusText}`, {root: true});
        }
      };
      xhr.send();
    }
  }
}
