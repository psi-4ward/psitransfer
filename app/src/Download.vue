<template lang="pug">
  .download-app
    .btn-group(style='position: absolute; top: 15px; right: 15px;')
      a.btn.btn-sm.btn-info(@click='newSession()', title='New Upload')
        i.fa.fa-fw.fa-cloud-upload
        |  new upload
    .alert.alert-danger(v-show="error")
      strong
        i.fa.fa-exclamation-triangle
        |  {{ error }}
    .well(v-if='needsPassword')
      h3(style='margin-top: 0') Password
      .form-group
        input.form-control(type='password', v-model='password')
      p.text-danger(v-show='passwordWrong')
        strong Access denied!
      |
      button.btn.btn-primary(:disabled='password.length<1', @click='decrypt()')
        i.fa.fa-key
        |  decrypt
    .panel.panel-primary(v-if='!needsPassword')
      .panel-heading Files
      .panel-body
        table.table.table-hover.table-striped(style='margin-bottom: 0')
          tbody
            tr(v-for='file in files', style='cursor: pointer', @click='download(file)')
              td(style='width: 60px')
                file-icon(:file='file')
              td
                p
                  clipboard.pull-right(:value='host + file.url', @change='copied(file, $event)', title='Copy to clipboard', style='margin-left: 5px')
                    a
                      i.fa.fa-fw.fa-copy
                  i.fa.fa-check.text-success.pull-right(v-show='file.downloaded')
                  |
                  strong {{ file.metadata.name }}
                  |
                  small ({{ humanFileSize(file.size) }})
                p {{ file.metadata.comment }}
</template>


<script>
  "use strict";
  import AES from 'crypto-js/aes';
  import encUtf8 from 'crypto-js/enc-utf8';

  import FileIcon from './common/FileIcon.vue';
  import Clipboard from './common/Clipboard.vue';

  export default {
    name: 'app',
    components: { FileIcon, Clipboard },
    data () {
      return {
        files: [],
        sid: document.location.pathname.substr(1),
        passwordWrong: false,
        needsPassword: false,
        password: '',
        content: '',
        error: '',
        host: document.location.protocol + '//' + document.location.host
      }
    },
    methods: {
      download(file) {
        if(file.downloaded && file.metadata.retention === 'one-time') {
          alert('One-Time Download: File is not available anymore.');
          return;
        }
        document.location.href = file.url;
        file.downloaded = true;
      },

      copied(file, $event) {
        file.downloaded = $event === 'copied';
      },

      decrypt() {
        this.passwordWrong = false;
        this.files = this.files.map(item => {
          if(typeof item === 'object') return item;
          const d = AES.decrypt(item, this.password);
          try {
            return Object.assign(
              JSON.parse(d.toString(encUtf8)),
              {downloaded: false}
            );
          } catch(e) {
            this.passwordWrong = true;
            return item;
          }
        });
        if(!this.passwordWrong) {
          this.needsPassword = false;
          this.password = '';
        }
      },

      humanFileSize(fileSizeInBytes) {
        let i = -1;
        const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        do {
          fileSizeInBytes = fileSizeInBytes / 1024;
          i++;
        }
        while(fileSizeInBytes > 1024);
        return Math.max(fileSizeInBytes, 0.01).toFixed(2) + byteUnits[i];
      },

      newSession() {
        document.location.href = '/';
      }
    },

    beforeMount() {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/' + this.sid + '.json');
      xhr.onload = () => {
        if(xhr.status === 200) {
          try {
            this.files = JSON.parse(xhr.responseText).map(f => {
              if(typeof f !== 'object') {
                this.needsPassword = true;
                return f;
              }
              return Object.assign(f, {downloaded: false});
            });
          } catch(e) {
            this.error = e.toString();
          }
        } else {
          this.error = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
        }
      };
      xhr.send();
    }
  }
</script>
