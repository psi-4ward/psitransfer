<template lang="pug">
  div.upload-files(:class="{empty:files.length === 0}")
    .empty-files-big-plus(:style="{cursor: disabled ? 'default' : 'pointer'}",
              onclick="document.getElementById('fileInput').click();",
              v-show="files.length === 0")
      span
        icon(name="plus", scale="4")
        br
        |  Drag your files here
    table.table.table-striped
      tbody
        tr(v-for="file in files", style="position: relative; transform: scale(1)", :disabled="disabled")
          td.file-icon(style="position: relative; overflow: hidden")
            file-icon(:file="file._File", style="position: absolute; width: 100%; text-align: center; top: 50%; transform: translateY(-50%)")
          td
            p
              strong.pull-left  {{ file.name }}
              span.pull-right(style="font-size: 1em; margin-left: 2em") {{ file.humanSize }}
            p
              input.pull-left.form-control.input-sm(type="text", placeholder="comment...", v-model="file.comment", :disabled="disabled")
            .alert.alert-danger(v-if="file.error")
              icon.fa-fw(name="exclamation-triangle")
              |  {{ file.error }}
            .progress.progress-background(v-show="!file.error && (state === 'uploading' || state === 'uploaded')")
              .progress-bar.progress-bar-info.progress-bar-striped(v-if="files.indexOf(file) % 2 === 0", :style="{width: file.progress.percentage+'%'}", :class="{active:state === 'uploading'}")
              .progress-bar.progress-bar-warning.progress-bar-striped(v-if="files.indexOf(file) % 2 === 1", :style="{width: file.progress.percentage+'%'}", :class="{active:state === 'uploading'}")
          td.btns
            span(:style="{cursor: disabled ? 'not-allowed' : 'pointer'}", @click="!disabled && $store.commit('upload/REMOVE_FILE', file)", :disabled="disabled")
              icon(name="times")
        tr(v-if="files.length > 0", style="position: relative; transform: scale(1)", :disabled="disabled")
          td
            strong(style="display: block; text-align: right") Total
          td
            span.pull-right {{ totalHumanSize }}
            div(v-show='percentUploaded > 0', style="text-align: center") {{ percentUploaded }}%
          td
          .progress.progress-background(v-show="(state === 'uploading' || state === 'uploaded')")
            .progress-bar.progress-bar-success.progress-bar-striped(:style="{width: percentUploaded+'%'}", :class="{active:state === 'uploading'}")

    input#fileInput(type="file", @change="$store.dispatch('upload/addFiles', $event.target.files)", multiple="", :disabled="disabled", style="display: none")
    .text-right(style="width: 40%")
      span.upload-button.btn.btn-default.btn-block(onclick="document.getElementById('fileInput').click();", :disabled="disabled", v-show="files.length>0")
        icon(name="plus-circle")
        |  Add More
</template>


<script type="text/babel">
  "use strict";
  import { mapState, mapGetters } from 'vuex';
  import dragDrop from 'drag-drop';
  import FileIcon from '../common/FileIcon.vue';
  import 'vue-awesome/icons/plus'
  import 'vue-awesome/icons/plus-circle'
  import 'vue-awesome/icons/times'
  import 'vue-awesome/icons/exclamation-triangle'

  export default {
    name: 'Files',

    components: { FileIcon },

    computed: {
      ...mapState({
        disabled: 'disabled',
        state: 'state',
        totalHumanSize: state => state.upload.totalHumanSize,
        files: state => state.upload.files
      }),
      ...mapGetters('upload', ['percentUploaded']),
    },

    mounted() {
      // init drop files support on <html>
      dragDrop('html', files => this.disabled ? null : this.$store.dispatch('upload/addFiles', files));
    }
  };
</script>

<style scoped>
  .upload-files.empty {
    background-image: linear-gradient(15deg, #bce8f1, #31708f);
    box-shadow: 0 10px 40px #31708f;
  }
  .upload-files {
    background-image: linear-gradient(15deg, #bce8f111, #31708f84);
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    min-height: 50vh;
    margin-bottom: 2em;
    padding: 2em;
  }
  .upload-files * {
    word-break: break-all;
  }
  .empty-files-big-plus {
    color: white;
    transition: 0.25s transform ease;
    border: 5px rgba(255, 255, 255, 0.5) dashed;
    border-radius: 5px;
    padding: 5em;
    text-align: center;
  }
  .empty-files-big-plus:hover, .empty-files-big-plus:focus {
    transform: scale(1.12);
  }
  .progress-background {
    position: absolute;
    width: 100%;
    z-index: -1;
    height: 100%;
    top: 0;
    left: 0;
  }
  .table tr:first-of-type .progress-background {
    border-radius: 15px 15px 0 0;
  }
  .table tr:last-of-type .progress-background {
    border-radius: 0 0 15px 15px;
  }
  .table {
    border-collapse: separate;
  }
  .table-striped > tbody > tr:nth-of-type(2n+1) {
    color: #017bbb;
    background-color: unset;
  }
  .table-striped > tbody > tr:nth-of-type(2n) {
    background-color: unset;
    color: #C17600;
  }
  .table-striped > tbody > tr > td {
    background-color: rgba(255, 255, 255, 0.5);
  }
  .table-striped > tbody > tr:first-of-type {
    background-color: unset;
  }
  .table-striped > tbody > tr:last-of-type {
    background-color: unset;
    color: white;
    transition: 0.25 color ease;
  }
  .table-striped > tbody > tr:last-of-type > td {
    background-color: rgba(0, 0, 0, 0.4);
  }
  .table-striped > tbody > tr:first-of-type > td:first-of-type {
    border-radius: 15px 0 0 0;
  }
  .table-striped > tbody > tr:first-of-type > td:last-of-type {
    border-radius: 0 15px 0 0;
  }
  .table-striped > tbody > tr:last-of-type > td:first-of-type {
    border-radius: 0 0 0 15px;
  }
  .table-striped > tbody > tr:last-of-type > td:last-of-type {
    border-radius: 0 0 15px 0;
  }
  .table-striped > tbody > tr > td {
    border: none;
  }
  input {
    border-radius: 20px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }
  /* Safari only, since Safari don't support using element as background */
  _::-webkit-full-page-media, _:future, :root .table tr .progress-background {
    border-radius: 4px;
  }
  _::-webkit-full-page-media, _:future, :root .progress-background {
    position: relative;
    z-index: initial;
    top: initial;
    left: initial;
    height: 10px;
    display: block;
    width: 100%;
    transform: translateY(10px);
  }
  _::-webkit-full-page-media, _:future, :root .table-striped > tbody > tr:not(:last-of-type) > td {
    background-color: rgba(255, 255, 255, 0.5);
  }
  _::-webkit-full-page-media, _:future, :root tr:last-of-type .progress-background {
    display: none;
  }
  /* Firefox only, since Firefox don't support background color with alpha channel while using element as background */
  @-moz-document url-prefix() {
    .table-striped > tbody > tr[disabled] > td {
      background-color: initial;
    }
    .table-striped > tbody > tr[disabled]:last-of-type {
      color: rgba(0, 0, 0, 0.8);
    }
    .table tr .progress-background {
      opacity: 0.5;
    }
  }
</style>