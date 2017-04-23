<template lang="pug">
  div
    i.fa.fa-fw.fa-3x(v-if='!isImageBlob', :class='iconClass')
    |
    img(v-if='isImageBlob', :src='blobUrl', style='width:54px; height:auto;')
</template>


<script type="text/babel">
  "use strict";

  export default {
    props: ['file'],

    computed: {
      iconClass() {
        const type = this.file.type || this.file.metadata && this.file.metadata.type;
        if(!type) return 'fa-file-o';
        if(type.startsWith('image')) return 'fa-file-image-o';
        if(type.startsWith('text')) return 'fa-file-text-o';
        if(type.startsWith('video')) return 'fa-file-video-o';
        if(type.startsWith('audio')) return 'fa-file-audio-o';
        if(type === 'application/pdf') return 'fa-file-pdf-o';
        if(type.startsWith('application')) return 'fa-file-archive-o';
        return 'fa-file-o';
      },
      isImageBlob() {
        if(!URL && !webkitURL) return false;
        return this.file instanceof File && this.file.type.startsWith('image');
      },
      blobUrl() {
        if(!this.isImageBlob) return;
        return (URL || webkitURL).createObjectURL(this.file);
      }
    }
  };
</script>
