<template lang="pug">
  div.file-icon
    icon(:name="iconClass", v-if="!isImageBlob", scale="3")
    |
    img(v-if='isImageBlob', :src='blobUrl')
</template>


<script type="text/babel">
  import 'vue-awesome/icons/file-image-o';
  import 'vue-awesome/icons/file-text-o';
  import 'vue-awesome/icons/file-video-o';
  import 'vue-awesome/icons/file-audio-o';
  import 'vue-awesome/icons/file-archive-o';
  import 'vue-awesome/icons/file-o';

  export default {
    props: ['file'],

    computed: {
      iconClass() {
        const type = this.file.type || this.file.metadata && this.file.metadata.type;
        if(!type) return 'file-o';
        if(type.startsWith('image')) return 'file-image-o';
        if(type.startsWith('text')) return 'file-text-o';
        if(type.startsWith('video')) return 'file-video-o';
        if(type.startsWith('audio')) return 'file-audio-o';
        if(type === 'application/pdf') return 'file-pdf-o';
        if(type.startsWith('application')) return 'file-archive-o';
        return 'file-o';
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
