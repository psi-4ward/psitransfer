<template lang="pug">
  div.upload-files
    .panel.panel-default(:class="{'panel-primary': !disabled}")
      .panel-heading Files
      .panel-body
        .empty-files-big-plus(:style="{cursor: disabled ? 'default' : 'pointer'}",
                  onclick="document.getElementById('fileInput').click();",
                  v-show="files.length === 0")
          a
            icon(name="plus", scale="4")
            br
            |  Drop your files here
        table.table.table-striped
          tbody
            tr(v-for="file in files")
              td.file-icon
                file-icon(:file="file._File")
              td
                p
                  strong  {{ file.name }}
                  small  ({{ file.humanSize }})
                p
                  input.form-control.input-sm(type="text", placeholder="comment...", v-model="file.comment", :disabled="disabled")
                .alert.alert-danger(v-if="file.error")
                  icon.fa-fw(name="exclamation-triangle")
                  |  {{ file.error }}
                .progress(v-show="!file.error && (state === 'uploading' || state === 'uploaded')")
                  .progress-bar.progress-bar-success.progress-bar-striped(:style="{width: file.progress.percentage+'%'}",:class="{active:!file.uploaded}")
              td.btns
                a(:style="{cursor: disabled ? 'not-allowed' : 'pointer'}", @click="!disabled && $store.commit('upload/REMOVE_FILE', file)", :disabled="disabled")
                  icon(name="times")

        input#fileInput(type="file", @change="$store.dispatch('upload/addFiles', $event.target.files)", multiple="", :disabled="disabled", style="display: none")
        .text-right
          a.btn.btn-success.btn-sm(onclick="document.getElementById('fileInput').click();", :disabled="disabled", v-show="files.length>0")
            icon(name="plus-circle")
</template>


<script type="text/babel">
  "use strict";
  import {mapState} from 'vuex';
  import dragDrop from 'drag-drop';
  import FileIcon from '../common/FileIcon.vue';
  import 'vue-awesome/icons/plus'
  import 'vue-awesome/icons/plus-circle'
  import 'vue-awesome/icons/times'
  import 'vue-awesome/icons/exclamation-triangle'

  export default {
    name: 'Files',

    components: { FileIcon },

    computed: mapState({
      disabled: 'disabled',
      state: 'state',
      files: state => state.upload.files
    }),

    mounted() {
      // init drop files support on <body>
      dragDrop('body', files => this.disabled ? null : this.$store.dispatch('upload/addFiles', files));
    }
  };
</script>
