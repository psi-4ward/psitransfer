<template>
  <Iconify :icon="resolvedIcon" :class="classes" v-bind="$attrs" />
  
</template>

<script>
  import { Icon as Iconify } from '@iconify/vue';
  export default {
    name: 'Icon',
    components: { Iconify },
    props: {
      name: { type: String, required: true },
      class: { type: [String, Object, Array], default: '' }
    },
    computed: {
      resolvedIcon() {
        // Allow fully-qualified Iconify names like 'fa-solid:copy'
        if (this.name.includes(':')) return this.name;

        // Map legacy vue-awesome (Font Awesome 5) icon names to Iconify collections
        const map = {
          // actions
          'copy': 'fa-regular:copy',
          'check': 'fa-solid:check',
          'times': 'fa-solid:times',
          'download': 'fa-solid:download',
          'upload': 'fa-solid:upload',
          'cloud-upload-alt': 'fa-solid:cloud-upload-alt',
          'undo-alt': 'fa-solid:undo-alt',
          'sync-alt': 'fa-solid:sync-alt',
          'spinner': 'fa-solid:spinner',
          'qrcode': 'fa-solid:qrcode',

          // status
          'exclamation-triangle': 'fa-solid:exclamation-triangle',

          // media/files
          'file': 'fa-regular:file',
          'file-alt': 'fa-regular:file-alt',
          'file-image': 'fa-regular:file-image',
          'file-video': 'fa-regular:file-video',
          'file-audio': 'fa-regular:file-audio',
          'file-archive': 'fa-regular:file-archive',
          'file-pdf': 'fa-regular:file-pdf',

          // ui
          'key': 'fa-solid:key',
          'sign-in-alt': 'fa-solid:sign-in-alt',
          'sign-out-alt': 'fa-solid:sign-out-alt',
          'arrow-left': 'fa-solid:arrow-left',
          'arrow-right': 'fa-solid:arrow-right',
          'eye': 'fa-regular:eye',
          'envelope': 'fa-regular:envelope',
          'plus': 'fa-solid:plus',
          'plus-circle': 'fa-solid:plus-circle'
        };

        return map[this.name] || `fa-solid:${this.name}`;
      },
      classes() {
        return this.class;
      }
    }
  }
</script>
