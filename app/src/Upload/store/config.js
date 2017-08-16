'use strict';
import Vue from 'vue';
import Location from '../../common/location';

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
      xhr.open('GET', Location.current() + 'config.json');
      xhr.onload = () => {
        if(xhr.status === 200) {
          try {
            const conf = JSON.parse(xhr.responseText);
            commit('SET', conf);
            commit('upload/RETENTION', conf.defaultRetention, {root:true});
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
