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
                div.pull-right
                  i.fa.fa-check.text-success(v-show='file.downloaded')
                  clipboard.btn.btn-sm.btn-default(:value='host + file.url', @change='copied(file, $event)', title='Copy to clipboard', style='margin: 0 5px')
                    a
                      i.fa.fa-fw.fa-copy
                  a.btn.btn-sm.btn-default(title="preview", @click.prevent.stop="preview=file", v-if="getPreviewType(file)")
                    i.fa.fa-fw.fa-eye
                p
                  strong {{ file.metadata.name }}
                  |
                  small(style="margin-left:15px") ({{ humanFileSize(file.size) }})
                p {{ file.metadata.comment }}

    modal(v-if="preview", @close="preview=false", :has-header="true")
      h4(slot="header") {{preview.metadata.name}}
      div(slot="body")
        div(v-if="getPreviewType(preview) === 'image'", style="text-align:center")
          img(:src="preview.url", style="max-width: 100%; height:auto")
        div(v-if="getPreviewType(preview) === 'text'")
          pre {{ previewText }}
        p(v-if="getPreviewType(preview) === false", style="text-align:center")
          strong.text-danger No preview available
</template>


<script>
  "use strict";
  import AES from 'crypto-js/aes';
  import encUtf8 from 'crypto-js/enc-utf8';

  import FileIcon from './common/FileIcon.vue';
  import Clipboard from './common/Clipboard.vue';
  import Modal from './common/Modal.vue';

  export default {
    name: 'app',
    components: { FileIcon, Clipboard, Modal },
    data () {
      return {
        files: [],
        sid: document.location.pathname.substr(1),
        passwordWrong: false,
        needsPassword: false,
        password: '',
        content: '',
        error: '',
        host: document.location.protocol + '//' + document.location.host,
        config: {},
        preview: false,
        previewText: ''
      }
    },

    watch: {
      preview: function(preview, old) {
        if(this.getPreviewType(preview) !== 'text' || preview === old) return;
        this.getPreviewText();
      }
    },

    methods: {
      getPreviewType(file) {
        if(!file || !file.metadata.type) return false;
        if(file.metadata.retention === 'one-time') return false;
        // no preview for files size > 2MB
        if(file.size > this.config.maxPreviewSize) return false;
        if(file.metadata.type.startsWith('image/')) return 'image';
        else if(file.metadata.type.startsWith('text/')) return 'text';
        return false;
      },
      getPreviewText() {
        this.previewText = '';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '//' + document.location.host + this.preview.url);
        xhr.onload = () => {
          if(xhr.status === 200) {
            this.previewText = xhr.responseText
          } else {
            this.previewText = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
          }
        };
        xhr.send();
      },

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
            let data = JSON.parse(xhr.responseText);
            this.config = data.config;
            this.files = data.items.map(f => {
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
