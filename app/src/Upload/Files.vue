<template lang="pug">
  div.upload-files
    .panel.panel-default(:class="{'panel-primary': !disabled}")
      .panel-heading
        span.pull-right(v-show="bucketSize > 0") {{ humanFileSize(bucketSize) }}
        strong {{ $root.lang.files }}
      .panel-body
        .empty-files-big-plus(:style="{cursor: disabled ? 'default' : 'pointer'}",
          onclick="document.getElementById('fileInput').click();",
          v-show="files.length === 0")
          a
            icon(name="plus", scale="4")
            br
            |  {{ $root.lang.dropFilesHere }}
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
                  input.form-control.input-sm(type="text", :placeholder="$root.lang.comment", v-model="file.comment", :disabled="disabled")
                .alert.alert-danger(v-if="file.error")
                  icon.fa-fw(name="exclamation-triangle")
                  |  {{ file.error }}
                .progress(v-show="!file.error && (state === 'uploading' || state === 'uploaded')")
                  .progress-bar.progress-bar-success.progress-bar-striped(:style="{width: file.progress.percentage+'%'}", :class="{active:!file.uploaded}")
              td.btns
                a(style="cursor:pointer"
                  @click="$store.dispatch('upload/removeFile', file)"
                  v-show="!disabled || bucketSizeError"
                )
                  icon(name="times")

        input#fileInput(type="file", @change="$store.dispatch('upload/addFiles', $event.target.files)", multiple="", :disabled="disabled", style="display: none")
        .text-right
          a.btn.btn-success.btn-sm(onclick="document.getElementById('fileInput').click();", :disabled="disabled", v-show="files.length>0")
            icon(name="plus-circle")
</template>


<script type="text/babel">
  import dragDrop from 'drag-drop';
  import 'vue-awesome/icons/exclamation-triangle'
  import 'vue-awesome/icons/plus'
  import 'vue-awesome/icons/plus-circle'
  import 'vue-awesome/icons/times'
  import { mapGetters, mapState } from 'vuex';
  import FileIcon from '../common/FileIcon.vue';
  import { humanFileSize } from "./store/upload";

  export default {
    name: 'Files',

    components: { FileIcon },

    computed: {
      ...mapState('upload', ['files']),
      ...mapState(['state',]),
      ...mapGetters('upload', ['bucketSize', 'bucketSizeError']),
      ...mapGetters(['disabled']),
    },

    mounted() {
      // init drop files support on <body>
      this.dragDropCleanup = dragDrop('body', files => this.$store.dispatch('upload/addFiles', files));
    },

    watch: {
      state: function(state) {
        if(state === 'uploading') {
          this.dragDropCleanup();
        }
      }
    },

    methods: {
      humanFileSize,
    }
  };
</script>
