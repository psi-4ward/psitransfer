<template lang="pug">
  modal.preview-modal(v-if="current", @close="current=false", :has-header="true", @next="next", @prev="prev")
    div.header(slot="header")
      p
        strong {{current.metadata.name}}
      div
        small {{currentIndex+1}} / {{files.length}}
        span.btn-group
          a.btn.btn-sm.btn-default(title="previous", @click="prev", v-show="currentIndex > 0")
            icon(name="arrow-left")
          a.btn.btn-sm.btn-default(title="next", @click="next", v-show="currentIndex < files.length-1")
            icon(name="arrow-right")
          a.btn.btn-sm.btn-default(title="toggle line wrap", @click="lineWrap = !lineWrap", :class="{active:lineWrap}", v-show="current.previewType === 'text'")
            icon(name="undo-alt", flip="vertical")
    div(slot="body")
      div(v-if="current.previewType === 'image'", style="text-align:center")
        img(:src="current.url", style="max-width: 100%; height:auto")
      div(v-if="current.previewType === 'text'")
        pre(:style="{'white-space':lineWrap?'pre-wrap':'pre'}") {{ previewText }}
      p(v-if="current.previewType === false", style="text-align:center")
        strong.text-danger {{ $root.lang.noPreviewAvailable }}
</template>


<script type="text/babel">
  import Modal from '../common/Modal.vue';
  import 'vue-awesome/icons/arrow-left';
  import 'vue-awesome/icons/arrow-right';
  import 'vue-awesome/icons/undo-alt';

  export default {
    components: { Modal },
    props: ['preview', 'files', 'maxSize'],
    data() {
      return {
        previewText: '',
        lineWrap: false,
        current: false
      };
    },

    computed: {
      currentIndex: function() {
        return this.files.indexOf(this.current);
      }
    },

    watch: {
      preview: function(preview) {
        this.current = preview
      },
      current: function(val, old) {
        if(val === false) this.$emit('close');
        if(val.previewType === 'text' && val !== old) this.getPreviewText();
      },
    },

    methods: {
      next() {
        if(this.currentIndex >= this.files.length-1) return;
        this.current = this.files[this.currentIndex + 1];
      },

      prev() {
        if(this.currentIndex <= 0) return;
        this.current = this.files[this.currentIndex - 1];
      },

      getPreviewText() {
        this.previewText = '';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', this.current.url);
        xhr.onload = () => {
          if(xhr.status === 200) {
            this.previewText = xhr.responseText
          } else {
            this.previewText = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
          }
        };
        xhr.send();
      },
    }
  };
</script>
