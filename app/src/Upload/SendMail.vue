<template lang="pug">
  div()
    .panel.panel-success()
      .panel-heading
        strong {{ $root.lang.sendViaMail }}
      .panel-body
        .form-group
          label(for='to') Send to
          input.form-control(type="email" id="to" placeholder="E-Mail addresses" multiple autofocus)
        .form-group
          label(for='from') My E-Mail address
          input.form-control(type="email" id="from" placeholder="E-Mail address")
        .form-group
          label(for='message') My message
          textarea.form-control(id="message" placeholder="Meine Nachricht")
        .form-group.text-right
          button#sendMailBtn.btn.btn-success(@click="alert('Diese Funktion ist noch nicht implementiert')")
            icon.fa-fw(name="paper-plane")
            |  send
</template>

<script type="text/babel">
  import { mapState } from 'vuex';
  import 'vue-awesome/icons/paper-plane';

  export default {
    name: 'SendMail',

    methods: {
      alert(v) {
        alert(v);
      }
    }
  };
</script>
