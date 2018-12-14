import tus from "tus-js-client";
import uuid from 'uuid/v4';
import md5 from 'crypto-js/md5';

function humanFileSize(fileSizeInBytes) {
  let i = -1;
  const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
  do {
    fileSizeInBytes = fileSizeInBytes / 1024;
    i++;
  }
  while(fileSizeInBytes > 1024);
  return Math.max(fileSizeInBytes, 0.01).toFixed(2) + byteUnits[i];
}

let onOnlineHandler = null;
let onOnlineHandlerAttached = false;

function getSid() {
  // support setting an explicit SID by location search param
  const match = document.location.search.match(/sid=([^&]+)/);
  if(match) {
    return match[1];
  } else {
    return md5(uuid()).toString().substr(0, 12);
  }
}

export default {
  namespaced: true,

  state: {
    retention: null,
    password: '',
    files: [],
    sid: getSid(),
    bytesUploaded: 0,

  },

  getters: {
    shareUrl: state => {
      return document.location.protocol + '//' + document.location.host + '/' + state.sid;
    },
    percentUploaded: state => {
      return Math.min(
        Math.round(state.files.reduce((sum, file) => sum += file.progress.percentage, 0) / state.files.length), 100);
    }
  },

  mutations: {
    RETENTION(state, seconds) {
      state.retention = seconds;
    },
    PASSWORD(state, pwd) {
      state.password = pwd;
    },
    ADD_FILE(state, file) {
      state.files.splice(0, 0, file);
    },
    REMOVE_FILE(state, file) {
      let index = state.files.indexOf(file);
      if(index > -1) state.files.splice(index, 1);
    },
    UPDATE_FILE(state, payload) {
      for(let k in payload.data) {
        payload.file[k] = payload.data[k];
      }
    },
    NEW_SESSION(state) {
      state.password = '';
      state.files.splice(0, state.files.length);
      state.sid = md5(uuid()).toString().substr(0, 12);
    }
  },


  actions: {
    addFiles({commit, state}, files) {
      if(state.disabled) return;
      for(let i = 0; i < files.length; i++) {
        // wrap, don't change the HTML5-File-API object
        commit('ADD_FILE', {
          _File: files[i],
          name: files[i].name,
          comment: '',
          progress: {percentage: 0, humanSize: 0},
          uploaded: false,
          error: false,
          humanSize: humanFileSize(files[i].size),
          _retryDelay: 500,
          _retries: 0
        });
      }
    },

    upload({commit, dispatch, state}) {
      commit('STATE', 'uploading', {root:true});
      commit('ERROR', '', {root:true});

      if(onOnlineHandler === null) {
        onOnlineHandler = function() {
          onOnlineHandlerAttached = false;
          commit('ERROR', false, {root: true});
          dispatch('upload');
        }
      }
      if(onOnlineHandlerAttached) window.removeEventListener('online', onOnlineHandler);

      // upload all files in parallel
      state.files.forEach(file => {
        file.error = '';
        file._retries = 0;
        file._retryDelay = 500;

        const _File = file._File;
        let tusUploader = new tus.Upload(_File, {
          metadata: {
            sid: state.sid,
            retention: state.retention,
            password: state.password,
            name: file.name,
            comment: file.comment,
            type: file._File.type
          },
          resume: true,
          endpoint: "/files/",
          fingerprint: (file) => {
            // include sid to prevent duplicate file detection on different session
            return ["tus", state.sid, file.name, file.type, file.size, file.lastModified].join("-");
          },
          retryDelays: null,
          onError(error) {
            // browser is offline
            if(!navigator.onLine) {
              commit('ERROR', 'You are offline. Your uploads will resume as soon as you are back online.', {root: true});
              if(!onOnlineHandlerAttached) {
                onOnlineHandlerAttached = true;
                // attach onOnline handler
                window.addEventListener('online', onOnlineHandler);
              }
            }
            // Client Error
            else if(error && error.originalRequest &&
                      error.originalRequest.status >= 400 && error.originalRequest.status < 500)
            {
                commit('UPDATE_FILE', {file, data: {error: error.message || error.toString()}});
            }
            // Generic Error
            else {
              if(file._retries > 30) {
                commit('UPDATE_FILE', {file, data: {error: error.message || error.toString()}});
                if(state.files.every(f => f.error)) {
                  commit('STATE', 'uploadError', {root: true});
                  commit('ERROR', 'Upload failed.', {root: true});
                }
                return;
              }

              file._retryDelay = Math.min(file._retryDelay*1.7, 10000);
              file._retries++;
              if(console) console.log(error.message || error.toString(), '; will retry in', file._retryDelay, 'ms');
              setTimeout(() => tusUploader.start(), file._retryDelay);
            }
          },
          onProgress(bytesUploaded, bytesTotal) {
            // uploaded=total gets also emitted on error
            if(bytesUploaded === bytesTotal) return;

            file.error = '';
            file._retries = 0;
            file._retryDelay = 500;
            const percentage = Math.round(bytesUploaded / bytesTotal * 10000) / 100;
            commit('UPDATE_FILE', {
              file,
              data: {progress: {percentage, humanSize: humanFileSize(bytesUploaded)}}
            });
          },
          onSuccess() {
            localStorage.removeItem(tusUploader._fingerprint);
            commit('UPDATE_FILE', {file, data: {
              uploaded:true,
              progress: {percentage: 100, humanFileSize: file.humanSize}
            }});
            if(state.files.every(f => f.uploaded)) commit('STATE', 'uploaded', {root: true});
          }
        });
        tusUploader.start();
      });
    }
  }

}
