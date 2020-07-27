<template lang="pug">
  div()
    .panel.panel-success()
      .panel-heading
        strong {{ $root.lang.sendViaMail }}
      form.panel-body(@submit.prevent="send" v-if="!sendSuccess")
        .form-group
          label(for='to') {{ $root.lang.mailTo }}
          input.form-control(
            type="email"
            id="to"
            :placeholder="$root.lang.mailToPlaceholder"
            v-model="mail.to"
            multiple autofocus required
          )
        .form-group
          label(for='from') {{ $root.lang.mailFrom }}
          input.form-control(
            type="email"
            id="from"
            :placeholder="$root.lang.mailFromPlaceholder"
            v-model="mail.from"
            required
          )
        .form-group
          label(for='message') {{ $root.lang.mailMessage }}
          textarea.form-control(id="message" :placeholder="$root.lang.mailMessage" v-model="mail.message")
        .checkbox
          label
            input#downloadNotification(type="checkbox" v-model="mail.downloadNotifications")
            | {{ $root.lang.mailDownloadNotification }}
        .form-group.text-right
          button#sendMailBtn.btn.btn-success(type="submit")
            icon.fa-fw(name="paper-plane")
            |  {{ $root.lang.mailSendBtn }}
      .panel-body(v-else)
        strong {{ $root.lang.mailsSent }}
</template>

<script type="text/babel">
  import { mapState, mapGetters } from 'vuex';
  import 'vue-awesome/icons/paper-plane';
  import { httpPost } from "../common/util";

  export default {
    name: 'SendMail',

    data() {
      return {
        mail: {
          to: '',
          from: '',
          message: '',
          downloadNotifications: false
        },
        sendSuccess: false
      }
    },

    computed: {
      ...mapState('upload', ['sid']),
      ...mapGetters('upload', ['shareUrl'])
    },

    methods: {
      async send() {
        const data = {
          ...this.mail,
          sid: this.sid,
          lang: this.$root.lang.langCode,
          shareLink: this.shareUrl,
        }
        try {
          await httpPost('send-mail', data);
          this.sendSuccess = true;
        } catch(e) {
          alert(e);
        }
      }
    }
  };
</script>
