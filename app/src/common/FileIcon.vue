<template lang="pug">
  div.file-icon
    icon(:name="iconClass", v-if="!isImageBlob", scale="3")
    |
    img(v-if='isImageBlob', :src='blobUrl')
</template>


<script type="text/babel">
  import 'vue-awesome/icons/regular/file';
  import 'vue-awesome/icons/regular/file-image';
  import 'vue-awesome/icons/regular/file-alt';
  import 'vue-awesome/icons/regular/file-video';
  import 'vue-awesome/icons/regular/file-audio';
  import 'vue-awesome/icons/regular/file-archive';
  import 'vue-awesome/icons/regular/file-pdf';

  export default {
    props: ['file'],

    computed: {
      iconClass() {
        const type = this.file.type || this.file.metadata && this.file.metadata.type;
        if(!type) return 'regular/file';
        if(type.startsWith('image')) return 'regular/file-image';
        if(type.startsWith('text')) return 'regular/file-alt';
        if(type.startsWith('video')) return 'regular/file-video';
        if(type.startsWith('audio')) return 'regular/file-audio';
        if(type === 'application/pdf') return 'regular/file-pdf';
        if(type.startsWith('application')) return 'regular/file-archive';
        return 'regular/file';
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
