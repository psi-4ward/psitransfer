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
      i.fa.fa-fw(:class="{'fa-copy':state=='pristine','fa-check':state=='copied','fa-exclamation-triangle':state=='error'}")
      slot(name='text')  Copy
</template>


<script type="text/babel">
  "use strict";

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
          alert('Dein alter Browser unterstützt diese Funktion leider nicht.');
          console.error(e);
        }
        document.body.removeChild(el);
        this.state = success ? 'copied' : 'error';
        this.$emit('change', this.state);
      }
    }
  };
</script>
