import md5 from 'crypto-js/md5';
import * as tus from "tus-js-client";
import { v4 as uuid } from 'uuid';

export function humanFileSize(fileSizeInBytes) {
  let i = -1;
  const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
  do {
    fileSizeInBytes = fileSizeInBytes / 1024;
    i++;
  }
  while (fileSizeInBytes > 1024);
  return Math.max(fileSizeInBytes, 0.01).toFixed(2) + byteUnits[i];
}

let onOnlineHandler = null;
let onOnlineHandlerAttached = false;

function getSid() {
  // support setting an explicit SID by location search param
  const match = document.location.search.match(/sid=([^&]+)/);
  if (match) {
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
    uploadURI: (window.PSITRANSFER_UPLOAD_PATH || '/') + 'files',
  },

  getters: {
    shareUrl: state => {
      return document.head.getElementsByTagName('base')[0].href + state.sid;
    },
    percentUploaded: (state, getters) => {
      return Math.min(
        Math.round(getters.bytesUploaded / getters.bucketSize * 100), 100);
    },
    bytesUploaded: state => state.files.reduce((sum, file) => sum + file.progress.bytesUploaded, 0),
    bucketSize: state => {
      return state.files.reduce((sum, file) => sum + file._File.size, 0);
    },
    bucketSizeError: (state, getters, rootState) => {
      const maxBucketSize = rootState.config && rootState.config.maxBucketSize;
      if(!maxBucketSize) return false;
      if(getters.bucketSize > maxBucketSize) {
        return rootState.lang.bucketSizeExceed
          .replace('%%', humanFileSize(getters.bucketSize))
          .replace('%%', humanFileSize(maxBucketSize));
      }
      return false;
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
      if (index > -1) state.files.splice(index, 1);
    },
    UPDATE_FILE(state, payload) {
      for (let k in payload.data) {
        payload.file[k] = payload.data[k];
      }
    },
    NEW_SESSION(state) {
      state.password = '';
      state.files.splice(0, state.files.length);
      state.sid = md5(uuid()).toString().substr(0, 12);
    },
  },

  actions: {
    addFiles({ commit, state, rootState }, files) {
      if (state.disabled) return;
      for (let i = 0; i < files.length; i++) {
        let error = false;
        const { maxFileSize } = rootState.config;
        if (maxFileSize && files[i].size > maxFileSize) {
          error = rootState.lang.fileSizeExceed
            .replace('%%', humanFileSize(files[i].size))
            .replace('%%', humanFileSize(maxFileSize))
        }
        // wrap, don't change the HTML5-File-API object
        commit('ADD_FILE', {
          _File: files[i],
          name: files[i].name,
          comment: '',
          progress: { percentage: 0, humanSize: 0, bytesUploaded: 0 },
          uploaded: false,
          error,
          humanSize: humanFileSize(files[i].size),
          _retryDelay: 500,
          _retries: 0
        });
      }
    },

    removeFile({commit, state}, file) {
      commit('REMOVE_FILE', file);
    },

    upload({ commit, dispatch, state, rootState }) {
      commit('STATE', 'uploading', { root: true });
      commit('ERROR', '', { root: true });

      if (onOnlineHandler === null) {
        onOnlineHandler = function() {
          onOnlineHandlerAttached = false;
          commit('ERROR', false, { root: true });
          dispatch('upload');
        }
      }
      if (onOnlineHandlerAttached) window.removeEventListener('online', onOnlineHandler);

      // upload all files in parallel
      state.files.forEach(async file => {
        file.error = '';
        file._retries = 0;
        file._retryDelay = 500;

        const _File = file._File;
        const startTusUpload = () => {
          new tus.Upload(_File, {
            uploadUrl: file._uploadUrl,
            metadata: {
              sid: state.sid,
              retention: state.retention,
              password: state.password,
              name: file.name,
              comment: file.comment,
              type: file._File.type
            },
            headers: {
              "x-passwd": rootState.config.uploadPass
            },
            parallelUploads: 1,
            chunkSize: 5000000,
            endpoint: state.uploadURI,
            storeFingerprintForResuming: false,
            retryDelays: null,
            onAfterResponse: function(req, res) {
              // Remember uploadUrl for resuming
              if(req.getMethod() === 'POST'
                && req.getURL() === this.endpoint
                && res.getStatus() === 201
              ) {
                file._uploadUrl = res.getHeader('location');
              }
            },
            onError(error) {
              let jsonResMessage = null;
              try {
                jsonResMessage = JSON.parse(error.originalResponse.getBody()).message;
              }
              catch (e) {
              }
              // browser is offline
              if (!navigator.onLine) {
                commit('ERROR', 'You are offline. Your uploads will resume as soon as you are back online.', { root: true });
                if (!onOnlineHandlerAttached) {
                  onOnlineHandlerAttached = true;
                  // attach onOnline handler
                  window.addEventListener('online', onOnlineHandler);
                }
              }
              // Client Error
              else if (error && error.originalResponse && error.originalResponse._xhr &&
                error.originalResponse._xhr.status >= 400 && error.originalResponse._xhr.status < 500) {
                commit('UPDATE_FILE', {
                  file, data: {
                    error: jsonResMessage || error.message || error.toString()
                  }
                });
              }
              // Generic Error
              else {
                if (file._retries > 30) {
                  commit('UPDATE_FILE', {
                    file, data: {
                      error: jsonResMessage || error.message || error.toString()
                    }
                  });
                  if (state.files.every(f => f.error)) {
                    commit('STATE', 'uploadError', { root: true });
                    commit('ERROR', 'Upload failed.', { root: true });
                  }
                  return;
                }

                file._retryDelay = Math.min(file._retryDelay * 1.7, 10000);
                file._retries++;
                if (console) console.log(error.message || error.toString(), '; will retry in', file._retryDelay, 'ms');
                setTimeout(startTusUpload, file._retryDelay);
              }
            },
            onProgress(bytesUploaded, bytesTotal) {
              // uploaded=total gets also emitted on error
              if (bytesUploaded === bytesTotal) return;

              file.error = '';
              file._retries = 0;
              file._retryDelay = 500;
              const percentage = Math.round(bytesUploaded / bytesTotal * 10000) / 100;
              commit('UPDATE_FILE', {
                file,
                data: { progress: { percentage, humanSize: humanFileSize(bytesUploaded), bytesUploaded } }
              });
            },
            onSuccess() {
              commit('UPDATE_FILE', {
                file, data: {
                  uploaded: true,
                  progress: { percentage: 100, humanFileSize: file.humanSize, bytesUploaded: file._File.size }
                }
              });
              if (state.files.every(f => f.uploaded)) {
                fetch(state.uploadURI + '/' + state.sid + '?lock=yes', { method: 'PATCH' });
                commit('STATE', 'uploaded', { root: true });
              }
            }
          }).start();
        }
        startTusUpload();
      });
    }
  }

}
