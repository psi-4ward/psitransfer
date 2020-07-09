<template lang="pug">
  div(v-if="config && config.retentions")
    .panel.panel-default(:class="{'panel-info': !disabled}")
      .panel-heading Settings
      .panel-body
        .form-group
          label(for='retention') Retention
          |
          select#retention.form-control(:value='retention', :disabled='disabled',
          @change="$store.commit('upload/RETENTION', $event.target.value)")
            option(v-for='(label, seconds, index) in config.retentions',
            :value="seconds", :selected="seconds === retention") {{ label }}
        div
          label(for='password') Password
          .input-group(:class="{'has-error': config.requireBucketPassword && !password}")
            input#password.form-control(
              type='text'
              :value='password'
              @input="$store.commit('upload/PASSWORD', $event.target.value)"
              :disabled='disabled'
              :placeholder="config.requireBucketPassword ? 'required' : 'optional'"
              required="config.requireBucketPassword"
            )
            span.input-group-addon(style='cursor: pointer', title='generate password', @click='generatePassword()')
              icon(name="key")
</template>

<script type="text/babel">
  "use strict";
  import { mapState } from 'vuex';
  import 'vue-awesome/icons/key';

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
    }),

    methods: {
      generatePassword() {
        if (this.disabled) return;
        this.$store.commit('upload/PASSWORD', passGen.generate(10));
      }
    }
  };
</script>
