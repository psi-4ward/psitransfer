<template lang="pug">
  .upload-app
    .btn-group(style='position: absolute; top: 15px; right: 15px;')
      a.btn.btn-sm.btn-info(@click='newSession()', title='New Upload')
        i.fa.fa-fw.fa-cloud-upload
        |  new upload
    .alert.alert-danger(v-show="error")
      strong
        i.fa.fa-exclamation-triangle
        |  {{ error }}
    .well(v-show="state === 'uploaded'")
      .pull-right
        a.btn.btn-primary(style="margin-right: 5px", :href="mailLnk")
          i.fa.fa-fw.fa-envelope
          |  Mail
        clipboard.btn.btn-primary(:value='shareUrl')
      h3.text-success(style='margin-top: 0')
        i.fa.fa-check
        |  Upload completed
      div(style='margin-top: 1rem; padding-bottom: 0')
        strong(style="margin-right: 5px") Download Link:
        |
        a(:href='shareUrl') {{ shareUrl }}
    .row(style="margin-bottom:10px", v-show="state === 'uploading'")
      .col-xs-12
        i.fa.fa-spinner.fa-spin.fa-2x.fa-fw.pull-left
        .progress(style="height:25px")
          .progress-bar.progress-bar-success.progress-bar-striped.active(:style="{width: percentUploaded+'%'}", style="line-height:25px")
            span(v-show='percentUploaded>10') {{ percentUploaded }}%
    .row
      .col-sm-7
        files(:value="[]")
      .col-sm-5
        settings
        .text-right(v-show='files.length && !disabled')
          button.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
            i.fa.fa-upload
            |  upload
        .text-right(v-show="state === 'uploadError'")
          button.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
            i.fa.fa-upload
            |  retry
</template>

<script type="text/babel">
  "use strict";
  import {mapState, mapGetters} from 'vuex';

  import Settings from './Upload/Settings.vue';
  import Files from './Upload/Files.vue';
  import Clipboard from './common/Clipboard.vue'

  export default {
    name: 'App',
    components: {
      Settings,
      Files,
      Clipboard
    },

    computed: {
      ...mapState(['error', 'disabled', 'state']),
      ...mapState('upload', ['sid', 'files']),
      ...mapGetters('upload', ['percentUploaded', 'shareUrl']),
      mailLnk: function(){
        return this.$store.state.config
          && this.$store.state.config.mailTemplate
          && this.$store.state.config.mailTemplate.replace('%%URL%%', this.shareUrl);
      }
    },

    methods: {
      newSession() {
        if(!confirm('Create a new upload session?')) return;
        document.location.reload();
      }
    }

  }
</script>
