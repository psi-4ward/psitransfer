<template lang="pug">
  .upload-app#uploadApp
    .btn-group.btn-title
      div.username#username      
      a.btn.btn-sm.btn-info.btn-new-session#SignOut(@click='kcLogout()', title='Sign out')
        icon.fa-fw(name="sign-out-alt")
        span.hidden-xs  Sign Out
      a.btn.btn-sm.btn-info.btn-new-session#GuestAccess(@click="$store.dispatch('upload/addGuestAccess')", title='Create Temporary Guest Access',v-show="state !== 'guestAccess' && state !== 'uploaded'")
        icon.fa-fw(name="user-plus")
        span.hidden-xs  Guest Access
      a.btn.btn-sm.btn-info.btn-new-session(@click='newSession()', title='New Upload')
        icon.fa-fw(name="cloud-upload-alt")
        span.hidden-xs  new upload
    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}
    .well(v-if='needsPassword')
      h3 Password
      .form-group
        input.form-control(type='password', v-model='password')
      p.text-danger(v-show='passwordWrong')
        strong Access denied!
      |
      button.btn.btn-primary(:disabled='password.length<1', @click='decrypt()')
        icon.fa-fw(name="key")
        |  decrypt              
    .panel(v-if='!needsPassword')
      .well(v-show="state === 'uploaded'")
        .pull-right.btn-group
          a.btn.btn-primary(:href="mailLnk")
            icon.fa-fw(name="envelope")
            |  Mail
          clipboard.btn.btn-primary(:value='shareUrl')
        h3.text-success
          icon.fa-fw(name="check")
          |  Upload completed
        div.share-link
          span.title Download Link:
          |
          a(:href='shareUrl') {{ shareUrl }}
      .well(v-show="state === 'guestAccess'")
        .pull-right.btn-group
          a.btn.btn-primary(:href="guestLnk")
            icon.fa-fw(name="envelope")
            |  Mail
          clipboard.btn.btn-primary(:value='guestUrl')
        h3.text-success
          icon.fa-fw(name="check")
          |  Guest access created
        div.share-link
          span.title Guest Link:
          |
          a(:href='guestUrl') {{ guestUrl }}
      .row.overall-process(v-show="state === 'uploading'")
        .col-xs-12
          icon.pull-left(name="spinner", scale="2", spin="")
          .progress
            .progress-bar.progress-bar-success.progress-bar-striped.active(:style="{width: percentUploaded+'%'}")
              span(v-show='percentUploaded>10') {{ percentUploaded }}%
      .row
        .col-sm-7
          files
        .col-sm-5
          settings
          .text-right(v-show='files.length && !disabled')
            button.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
              icon.fa-fw(name="upload")
              |  upload         
          .text-right(v-show="state === 'uploadError'")
            button.btn.btn-lg.btn-success(@click="$store.dispatch('upload/upload')")
              icon.fa-fw(name="upload")
              |  retry
</template>

<script type="text/babel">
  "use strict";
  import AES from 'crypto-js/aes';
  import encUtf8 from 'crypto-js/enc-utf8';
  import MD5 from 'crypto-js/md5';
  
  import { mapState, mapGetters } from 'vuex';

  import Settings from './Upload/Settings.vue';
  import Files from './Upload/Files.vue';
  import Clipboard from './common/Clipboard.vue'
  import 'vue-awesome/icons/cloud-upload-alt';
  import 'vue-awesome/icons/upload';
  import 'vue-awesome/icons/check';
  import 'vue-awesome/icons/spinner';
  import 'vue-awesome/icons/envelope';
  import 'vue-awesome/icons/exclamation-triangle';
  import 'vue-awesome/icons/sign-out-alt';
  import 'vue-awesome/icons/user-plus';


  export default {
    name: 'App',
    components: {
      Settings,
      Files,
      Clipboard,
    },

    data () {
      return {
        passwordWrong: false,
        needsPassword: false,
        password: '',
        content: '',
        error: '',
        guestData: ''
      }
    },

    computed: {
      ...mapState(['error', 'disabled', 'state']),
      ...mapState('upload', ['sid', 'files']),
      ...mapGetters('upload', ['percentUploaded', 'shareUrl', 'guestUrl']),
      mailLnk: function() {
        return this.$store.state.config
          && this.$store.state.config.mailTemplate
          && this.$store.state.config.mailTemplate.replace('%%URL%%', this.shareUrl);
      },
      guestLnk: function() {
        return this.$store.state.config
          && this.$store.state.config.mailTemplateGuest
          && this.$store.state.config.mailTemplateGuest.replace('%%URL%%', this.guestUrl);
      }
    },

    watch: {
      state: function(val) {
        if (val === 'uploaded' || val === 'uploadError') {
          const el = document.getElementById('uploadApp');
          if (!el || !el.scrollIntoView) return;
          el.scrollIntoView(true);
        }
      }
    },

    methods: {
      newSession() {
        //if (!confirm('Create a new upload session?')) return;
        document.location.reload();
      },

      kcLogout() {
        kc.logout();
      },
 
      decrypt() {
        this.passwordWrong = false;
        
        if(typeof this.guestData === 'object') return item;
          let f = AES.decrypt(this.guestData, this.password);
          try {
            f = JSON.parse(f.toString(encUtf8));

            guestkey = f.key;
            kc.tokenParsed.name = "Guest of "+f.metadata.username;
            document.getElementById("username").innerHTML=kc.tokenParsed.name;

          } catch(e) {
            this.passwordWrong = true;
            return;
          }
          
        if(!this.passwordWrong) {
          this.needsPassword = false;
          this.password = '';
        }
      },
    },
 
    beforeMount() {
      const pathnames = document.location.pathname.split('/');

      if ((pathnames.length>2)&&(pathnames[pathnames.length-2]=='guest')) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/guest/' + pathnames[pathnames.length-1] + '.json');
        xhr.onload = () => {
          if(xhr.status === 200) {
            try {
              this.guestData = JSON.parse(xhr.responseText);
              if(typeof this.guestData !== 'object') {
                this.needsPassword = true;
                return;
              }
              else {
                guestkey = this.guestData.key;
                kc.tokenParsed.name = "Guest of "+this.guestData.metadata.username;
                document.getElementById("username").innerHTML=kc.tokenParsed.name;
              }
            } catch(e) {
              this.error = e.toString();
            }
          } else {
            this.error = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
          }
        };
        xhr.send();        
      }
    }

  }
</script>
<style>
  .btn-title {
    position: absolute;
    top: 15px;
    right: 10px;
  }
  .btn-title a {
    margin-right: 5px;
  }
  #SignOut, #GuestAccess {
    display:none;
  }
  #username {
    float: left;
    margin: 5px 15px;
  }
</style>