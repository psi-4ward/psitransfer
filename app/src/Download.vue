<template lang="pug">
  .download-app
    a.btn.btn-sm.btn-info.btn-new-session(@click='newSession()', :title='$root.lang.newUpload')
      icon.fa-fw(name="cloud-upload-alt")
      span.hidden-xs  {{ $root.lang.newUpload }}
    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}
    .well(v-if='needsPassword')
      h3 {{ $root.lang.password }}
      .form-group
        input.form-control(type='password', v-model='password', @keyup.enter='password.length && fetchBucket()')
      p.text-danger(v-show='passwordWrong')
        strong {{ $root.lang.accessDenied }}
      |
      button.decrypt.btn.btn-primary(:disabled='password.length<1', @click='fetchBucket()')
        icon.fa-fw(name="key")
        |  {{ $root.lang.decrypt }}
    .panel.panel-primary(v-if='!needsPassword && !loading')
      .panel-heading
        strong {{ $root.lang.files }}
        div.pull-right.btn-group.btn-download-archive(v-if="downloadsAvailable")
          a.btn.btn-sm.btn-default(@click="downloadAll('zip')", :title="$root.lang.zipDownload")
            icon.fa-fw(name="download")
            |  zip
          a.btn.btn-sm.btn-default(@click="downloadAll('tar.gz')", :title="$root.lang.tarGzDownload")
            icon.fa-fw(name="download")
            |  tar.gz
      .panel-body
        table.table.table-hover.table-striped.files
          tbody
            tr(v-for='file in files', style='cursor: pointer', @click='download(file)')
              td.file-icon
                file-icon(:file='file')
              td
                div.pull-right.btn-group
                  clipboard.btn.btn-sm.btn-default(:value='baseURI + file.url', @change='copied(file, $event)', :title='$root.lang.copyToClipboard')
                    a
                      icon(name="copy")
                  a.btn.btn-sm.btn-default(:title="$root.lang.preview", @click.prevent.stop="preview=file", v-if="file.previewType")
                    icon(name="eye")
                i.pull-right.fa.fa-check.text-success.downloaded(v-show='file.downloaded')
                p
                  strong {{ file.metadata.name }}
                  small.file-size(v-if="isFinite(file.size)") ({{ humanFileSize(file.size) }})
                p {{ file.metadata.comment }}

    preview-modal(:preview="preview", :files="previewFiles", :max-size="config.maxPreviewSize", @close="preview=false")

</template>


<script>
  "use strict";
  import MD5 from 'crypto-js/md5';

  import FileIcon from './common/FileIcon.vue';
  import Clipboard from './common/Clipboard.vue';
  import PreviewModal from './Download/PreviewModal.vue';

  import 'vue-awesome/icons/cloud-upload-alt';
  import 'vue-awesome/icons/exclamation-triangle';
  import 'vue-awesome/icons/copy';
  import 'vue-awesome/icons/check';
  import 'vue-awesome/icons/download';
  import 'vue-awesome/icons/key';
  import 'vue-awesome/icons/eye';

  function getPreviewType(file, maxSize) {
    if(!file || !file.metadata) return false;
    if(file.metadata.retention === 'one-time') return false;
    // no preview for files size > 2MB
    if(file.size > maxSize) return false;
    if(file.metadata.type && file.metadata.type.match(/^image\/.*/)) return 'image';
    else if(file.metadata.type && file.metadata.type.match(/(text\/|xml|json|javascript|x-sh)/)
      || file.metadata.name && file.metadata.name
        .match(/\.(jsx|vue|sh|pug|less|scss|sass|c|h|conf|log|bat|cmd|lua|class|java|py|php|yml|sql|md)$/)) {
      return 'text';
    }
    return false;
  }

  export default {
    name: 'app',
    components: { FileIcon, Clipboard, PreviewModal },
    data () {
      return {
        files: [],
        sid: document.location.pathname.match(/^.*\/([^\/?#]+)/)[1],
        baseURI: this.$root.baseURI,
        passwordWrong: false,
        needsPassword: false,
        loading: true,
        password: '',
        content: '',
        error: '',
        config: {},
        preview: false
      }
    },

    computed: {
      downloadsAvailable: function() {
        return this.files.filter(f => !f.downloaded || f.metadata.retention !== 'one-time').length > 0
      },
      previewFiles: function() {
        return this.files.filter(f => !!f.previewType);
      }

    },

    methods: {
      download(file) {
        if(file.downloaded && file.metadata.retention === 'one-time') {
          alert(this.$root.lang.oneTimeDownloadExpired);
          return;
        }
        const aEl = document.createElement('a');
        aEl.setAttribute('href', file.url);
        aEl.setAttribute('download', file.metadata.name);
        aEl.style.display = 'none';
        document.body.appendChild(aEl);
        aEl.click();
        document.body.removeChild(aEl);
        file.downloaded = true;
      },

      downloadAll(format) {
        document.location.href = this.$root.baseURI
          + '/files/' + this.sid + '++'
          + MD5(
            this.files
              .filter(f => !f.downloaded || f.metadata.retention !== 'one-time')
              .map(f => f.key).join()
          ).toString() + '.' + format;

        this.files.forEach(f => {
          f.downloaded = true;
        });
      },

      copied(file, $event) {
        file.downloaded = $event === 'copied';
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
        document.location.href = this.$root.baseURI;
      },

      isFinite(value) {
        if(typeof value !== 'number') return false;
        return !(value !== value || value === Infinity || value === -Infinity);
      },

      fetchBucket() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', this.sid + '.json');
        if(this.password) {
          xhr.setRequestHeader('x-download-pass', this.password);
        }
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              let data = JSON.parse(xhr.responseText);
              this.config = data.config;
              this.files = data.items.map(f => {
                return Object.assign(f, {
                  downloaded: false,
                  previewType: getPreviewType(f, this.config.maxPreviewSize)
                });
              });
              this.loading = false;
              this.needsPassword = false;
            }
            catch (e) {
              this.error = e.toString();
            }
          } else if (xhr.status === 401) {
            if(this.needsPassword) {
              this.passwordWrong = true;
            } else {
              this.needsPassword = true;
            }
            this.loading = false;
          } else {
            this.error = `${ xhr.status } ${ xhr.statusText }: ${ xhr.responseText }`;
          }
        };
        xhr.send();
      },
    },

    beforeMount() {
      this.fetchBucket();
    }
  }
</script>
