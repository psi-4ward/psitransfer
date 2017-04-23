<template lang="pug">
  div
    .panel.panel-default(:class="{'panel-primary': !disabled}")
      .panel-heading Files
      .panel-body
        .dropHint(:style="{cursor: disabled ? 'default' : 'pointer'}",
                  onclick="document.getElementById('fileInput').click();",
                  v-show="files.length === 0")
          i.fa.fa-plus.fa-4x
          br
          |  Drop your files here
        table.table.table-striped
          tbody
            tr(v-for="file in files")
              td(style="width: 60px")
                file-icon(:file="file._File")
              td
                p
                  strong  {{ file.name }}
                  small  ({{ file.humanSize }})
                p
                  input.form-control.input-sm(type="text", placeholder="comment...", v-model="file.comment", :disabled="disabled")
                .alert.alert-danger(v-if="file.error")
                  i.fa.fa-fw.fa-exclamation-triangle
                  |  {{ file.error }}
                .progress(v-show="!file.error && (state === 'uploading' || state === 'uploaded')", style="height:7px")
                  .progress-bar.progress-bar-success.progress-bar-striped(:style="{width: file.progress.percentage+'%'}",:class="{active:!file.uploaded}")
              td(style="width: 33px;")
                a.btn.btn-warning.btn-sm(@click="!disabled && $store.commit('upload/REMOVE_FILE', file)", :disabled="disabled")
                  i.fa.fa-trash.pull-right(style="display: inline-block; margin-left: auto; margin-right: auto;")

        input#fileInput(type="file", @change="$store.dispatch('upload/addFiles', $event.target.files)", multiple="", :disabled="disabled", style="display: none")
        .text-right
          a.btn.btn-success.btn-sm(onclick="document.getElementById('fileInput').click();", :disabled="disabled", v-show="files.length>0")
            i.fa.fa-plus-circle.fa-fw
</template>


<script type="text/babel">
  "use strict";
  import {mapState} from 'vuex';
  import dragDrop from 'drag-drop';
  import FileIcon from '../common/FileIcon.vue';

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
      dragDrop('body', files => this.$store.dispatch('upload/addFiles', files));
    }
  };
</script>

<style>
  .dropHint {
    text-align: center;
    padding: 19px 0;
  }
  .dropHint i {
    color: #337AB7;
  }
  .dropHint:hover i {
    color: #286090;
  }
</style>
