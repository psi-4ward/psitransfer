<!--
# Clipboard Component
Copies a string into the clipboard

## Props
* value: String

## Slots
* default: Replaces inner content
* text:    Replaces the text
-->

<template lang="pug">
  span(@click.stop='copy()', style='cursor: pointer')
    slot(:state='state')
      icon.fa-fw(name="copy", v-if="state==='pristine'")
      icon.fa-fw(name="check", v-if="state==='copied'")
      icon.fa-fw(name="exclamation-triangle", v-if="state==='error'")
      slot(name='text')  {{ $root.lang.clipboard }}
</template>


<script type="text/babel">
  import 'vue-awesome/icons/check';
  import 'vue-awesome/icons/copy';
  import 'vue-awesome/icons/exclamation-triangle';

  export default {
    name: "Clipboard",
    props: {
      value: {
        type: String,
        required: true
      }
    },
    data() {
      return {
        state: 'pristine' // copied, error
      };
    },
    methods: {
      copy() {
        let el = document.createElement('textarea');
        Object.assign(el.style, {
          position: 'absolute',
          left: '-200%'
        });
        el.value = this.value;
        document.body.appendChild(el);

        let success = false;
        try {
          el.select();
          success = document.execCommand('copy');
        }
        catch(e) {
          alert(this.$root.lang.oldBrowserError);
          console.error(e);
        }
        document.body.removeChild(el);
        this.state = success ? 'copied' : 'error';
        this.$emit('change', this.state);
      }
    }
  };
</script>
