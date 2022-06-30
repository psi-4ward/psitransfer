<template lang="pug">
  .upload-app#uploadApp
    a.btn.btn-sm.btn-info.btn-new-session(v-if='!showLogin', @click='newSession()', :title='$root.lang.newUpload')
      icon.fa-fw(name="cloud-upload-alt")
      span.hidden-xs  {{ $root.lang.newUpload }}
    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}
    form.well.upload-uploadPassword(v-if='showLogin', @submit.prevent='setUploadPass()')
      h3 {{ $root.lang.uploadPassword }}
      .form-group
        input.form-control(type='password', v-model='uploadPassword', autofocus)
      p.text-danger(v-show='uploadPasswordWrong')
        strong {{ $root.lang.accessDenied }}
      |
      button.uploadPass.btn.btn-primary(:disabled='uploadPassword.length<1', type="submit")
        icon.fa-fw(name="key")
        |  {{ $root.lang.login }}
    div(v-else-if="$root.configFetched")
      .well(v-show="state === 'uploaded'")
        .pull-right.btn-group.upload-success-btns
          a.btn.btn-primary(@click.prevent="showQrCode" href="#" :title="$root.lang.showQrCode")
            icon.fa-fw(name="qrcode")
            | QR-Code
          a.btn.btn-primary(:href="mailLnk" :title="$root.lang.sendViaMail")
            icon.fa-fw(name="envelope")
            |  {{ $root.lang.email }}
          clipboard.btn.btn-primary(:value='shareUrl' :title="$root.lang.copyToClipboard")
        h3.text-success
          icon.fa-fw(name="check")
          |  {{ $root.lang.uploadCompleted }}
        div.share-link
          span.title {{ $root.lang.downloadLink }}:
          |
          a(:href='shareUrl') {{ shareUrl }}
      .row.overall-process(v-show="state === 'uploading'")
        .col-xs-12
          icon.pull-left(name="spinner", scale="2", spin="", style="margin-right: 10px")
          .progress
            .progress-bar.progress-bar-success.progress-bar-striped.active(:style="{width: percentUploaded+'%'}")
              span(v-show='percentUploaded>8') {{ percentUploaded }}%
              span(v-show='percentUploaded>15' style="margin-left: 10px") ({{ humanFileSize(bytesUploaded) }} / {{ humanFileSize(bucketSize) }})
      .row
        .col-sm-7
          files
        .col-sm-5
          settings
          .text-right(v-show='showUploadBtn')
            button#uploadBtn.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
              icon.fa-fw(name="upload")
              |  {{ $root.lang.upload }}
          .text-right(v-show="state === 'uploadError'")
            button#uploadRetryBtn.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
              icon.fa-fw(name="upload")
              |  {{ $root.lang.retry }}
</template>

<script type="text/babel">
  import { Encoder, ErrorCorrectionLevel, QRByte } from "@nuintun/qrcode";
  import { mapState, mapGetters } from 'vuex';

  import Settings from './Upload/Settings.vue';
  import Files from './Upload/Files.vue';
  import Clipboard from './common/Clipboard.vue'
  import 'vue-awesome/icons/cloud-upload-alt';
  import 'vue-awesome/icons/upload';
  import 'vue-awesome/icons/check';
  import 'vue-awesome/icons/spinner';
  import 'vue-awesome/icons/envelope';
  import 'vue-awesome/icons/qrcode';
  import 'vue-awesome/icons/exclamation-triangle';
  import { humanFileSize } from "./Upload/store/upload";


  export default {
    name: 'Upload',
    components: {
      Settings,
      Files,
      Clipboard,
    },

    data() {
      return {
        uploadPassword: '',
        uploadPasswordWrong: null,
      }
    },

    computed: {
      ...mapState(['state']),
      ...mapState('config', ['uploadPassRequired', 'uploadPass', 'requireBucketPassword']),
      ...mapState('upload', ['sid', 'files', 'password']),
      ...mapGetters(['error', 'disabled']),
      ...mapGetters('upload', ['percentUploaded', 'shareUrl', 'bucketSize', 'bytesUploaded']),
      mailLnk: function() {
        return this.$store.state.config
          && this.$store.state.config.mailTemplate
          && this.$store.state.config.mailTemplate.replace('%%URL%%', this.shareUrl);
      },
      showLogin() {
        return this.uploadPassRequired && this.uploadPasswordWrong !== false;
      },
      showUploadBtn() {
        return this.files.length
          && !this.disabled
          && (this.requireBucketPassword && this.password || !this.requireBucketPassword)
      }
    },

    watch: {
      state: function(val) {
        if (val === 'uploaded' || val === 'uploadError') {
          const el = document.getElementById('uploadApp');
          if (!el || !el.scrollIntoView) return;
          el.scrollIntoView(true);
        }
      }
    },

    methods: {
      newSession() {
        if (!confirm(this.$root.lang.createNewUploadSession)) return;
        document.location.reload();
      },
      async setUploadPass() {
        try {
          this.$store.commit('config/SET', {uploadPass: this.uploadPassword});
          await this.$store.dispatch('config/fetch');
          this.uploadPasswordWrong = false;
        } catch(e) {
          if(e.code === 'PWDREQ') {
            this.uploadPassword = '';
            this.uploadPasswordWrong = true;
          } else {
            console.error(e);
          }
        }
      },
      showQrCode() {
        const qrcode = new Encoder();
        qrcode.setEncodingHint(true);
        qrcode.setErrorCorrectionLevel(ErrorCorrectionLevel.H);
        qrcode.write(new QRByte(this.shareUrl));
        qrcode.make();
        const imgSrc = qrcode.toDataURL(7, 10);
        const data = imgSrc.substr(imgSrc.indexOf(',') + 1);
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new Blob([byteArray], { type: 'image/gif;base64' });
        window.open(URL.createObjectURL(file));
      },
      humanFileSize
    }

  }
</script>

<style>
  @media all and (max-width: 500px) {
    .well {
      padding: 19px 8px;
    }
    .upload-success-btns {
      width: 100%;
      margin-bottom: 10px;
    }

    .upload-success-btns .btn {
      padding: 7px 5px;
      font-size: 12px;
    }
  }
</style>
