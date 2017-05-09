<template lang="pug">
  .modal.fade.in.background-darken(ref='modal', style="display:block", tabindex='-1', role='dialog', @click.self='close()', @keyup.esc='close()', @keyup.left="$emit('prev')", @keyup.right="$emit('next')")
    .modal-dialog.modal-fluid(role='document')
      .modal-content
        .modal-header(v-if='hasHeader')
          button.close(type='button', data-dismiss='modal', aria-label='Close', @click='close()')
            span(aria-hidden='true') &times;
          h4.modal-title
            slot(name='header')  Modal
        .modal-body
          slot(name='body')  Body
        .modal-footer(v-if='hasFooter')
          slot(name='footer')
</template>

<script>
  export default {
    props: {
      hasHeader: {
        type: Boolean,
        default: false
      },
      hasFooter: {
        type: Boolean,
        default: false
      }
    },

    mounted() {
      this.$nextTick(function() {
        this.$refs.modal.focus();
      });
    },

    methods: {
      close() {
        this.$emit('close');
      }
    }
  }
</script>
