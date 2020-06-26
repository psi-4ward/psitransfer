<template lang="pug">
  div(v-if="config && config.retentions")
    div.settings
      div.form-group(style='position: relative')
        label(for='retention') Retention
        |
        select#retention.form-control(:value='retention', :disabled='disabled',
        @change="$store.commit('upload/RETENTION', $event.target.value)")
          option(v-for='(label, seconds, index) in config.retentions',
          :value="seconds", :selected="seconds === retention") {{ label }}
        icon(name='caret-down', style='position: absolute; right: 1em; top: 2.5em; pointer-events: none')
      div.form-group
        label(for='password') Password
        .input-group
          input#password.form-control(type='text', :value='password',
          @input="$store.commit('upload/PASSWORD', $event.target.value)",
          :disabled='disabled', placeholder='optional')
          span.input-group-addon(:style="disabled ? 'cursor: not-allowed' : 'cursor: pointer'", title='generate password', @click='generatePassword()')
            icon(name="key")
      div(v-if='allowUserConfigChunkSize').form-group
        label(for='chunkSizeInMb') Chunk Size
        .input-group
          input#chunkSize.form-control(type='number', min=0, step=8, title='Smaller chunk will make upload more stable by splitting requests into smaller pieces but will take longer to finish',
          :value='chunkSizeInMb',
          @input='onChunkSizeInMbInputChange',
          :disabled='disabled', placeholder='infinite')
          span.input-group-addon MB
</template>

<script type="text/babel">
  "use strict";
  import { mapState } from 'vuex';
  import 'vue-awesome/icons/key';
  import 'vue-awesome/icons/caret-down';

  const passGen = {
    _pattern: /[A-Z0-9_\-+!]/,
    _getRandomByte: function() {
      const result = new Uint8Array(1);
      let fixedcrypto = window.msCrypto;
      if (!fixedcrypto) {
        fixedcrypto = window.crypto;
      }
      fixedcrypto.getRandomValues(result);
      return result[0];
    },
    generate: function(length) {
      let fixedcrypto2 = window.msCrypto;
      if (!fixedcrypto2) {
        fixedcrypto2 = window.crypto;
      }
      if (!fixedcrypto2 || !fixedcrypto2.getRandomValues) return '';
      return Array.apply(null, { 'length': length }).map(function() {
        let result;
        while (true) {
          result = String.fromCharCode(this._getRandomByte());
          if (this._pattern.test(result)) return result;
        }
      }, this).join('');
    }
  };

  export default {
    name: 'Settings',

    computed: mapState({
      config: 'config',
      disabled: 'disabled',
      retention: state => state.upload.retention,
      password: state => state.upload.password,
      chunkSizeInMb: state => state.upload.chunkSizeInMb === 0 ? '' : String(state.upload.chunkSizeInMb),
      allowUserConfigChunkSize: state => state.upload.allowUserConfigChunkSize
    }),

    methods: {
      generatePassword() {
        if (this.disabled) return;
        this.$store.commit('upload/PASSWORD', passGen.generate(10));
      },
      onChunkSizeInMbInputChange($event) {
        this.$store.commit('upload/CHUNK_SIZE_IN_MB', $event.target.value);
        // vue state/DOM out of sync since no rerender when no state change
        $event.target.value = this.chunkSizeInMb;
      }
    }
  };
</script>

<style scoped>
  .settings {
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background-image: linear-gradient(15deg, #e3b380, #ce8888);
    box-shadow: 0 10px 75px rgba(0, 0, 0, 0.5);
    min-height: 50vh;
    margin-bottom: 2em;
    padding: 4em;
  }
  select, input {
    border-radius: 20px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }
  .input-group-addon:last-child {
    border-radius: 0 20px 20px 0;
  }
  label {
    color: white;
  }
</style>