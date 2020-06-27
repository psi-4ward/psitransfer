<template lang="pug">
  .upload-app#uploadApp
    div.btn.btn-default.btn-new-session(@click='newSession()', title='New Upload')
      icon.fa-fw(name="cloud-upload-alt")
      span.hidden-xs  New Upload
    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}
    .uploaded(v-show="state === 'uploaded'")
      h3.text-success(style="text-align:center")
        icon.fa-fw(name="check")
        |  Upload Completed
      qrcode.qrcode(:value='shareUrl', size="200", style="text-align:center; margin:1em")
      div.share-link(style="text-align:center; margin-bottom:1em")
        span.title Download Link:
        |
        a(style="word-wrap:break-word; display:inline-block", :href='displayUrl') {{ displayUrl }}
      div.btn-group(style="margin:0 auto; display:flex; max-width:40em")
        a.btn.btn-warning(:href="mailLnk", style="flex:1")
          icon.fa-fw(name="envelope")
          |  Mail
        span.btn.btn-primary(v-if="showUrlShortenerButton", :disabled="!urlShortenerEnabled", @click='shorten()', style="flex:1")
          icon.fa-fw(name="link")
          |  Shorten
        clipboard.btn.btn-default(:value='displayUrl', style="flex:1")

    .row
      .col-sm-7
        files
      .col-sm-5
        settings
        .text-right(v-show='files.length && !disabled')
          button.btn.btn-lg.btn-info(@click="$store.dispatch('upload/upload')")
            icon.fa-fw(name="upload")
            |  Upload
        .text-right(v-show="state === 'uploadError'")
          button.btn.btn-lg.btn-warning(@click="$store.dispatch('upload/upload')")
            icon.fa-fw(name="upload")
            |  Retry
</template>

<script type="text/babel">
  "use strict";
  import { mapState, mapGetters } from 'vuex';

  import Settings from './Upload/Settings.vue';
  import Files from './Upload/Files.vue';
  import Clipboard from './common/Clipboard.vue'

  import Qrcode from 'qrcode.vue'
  import 'vue-awesome/icons/cloud-upload-alt';
  import 'vue-awesome/icons/upload';
  import 'vue-awesome/icons/check';
  import 'vue-awesome/icons/link';
  import 'vue-awesome/icons/envelope';
  import 'vue-awesome/icons/exclamation-triangle';


  export default {
    name: 'App',
    components: {
      Settings,
      Files,
      Clipboard,
      Qrcode
    },

    computed: {
      ...mapState(['error', 'disabled', 'state']),
      ...mapState('upload', ['sid', 'files', 'urlShortenerEndpoint', 'urlShortenerEnabled', 'shortenedUrl']),
      ...mapGetters('upload', ['shareUrl']),
      mailLnk: function() {
        return this.$store.state.config
          && this.$store.state.config.mailTemplate
          && this.$store.state.config.mailTemplate.replace('%%URL%%', this.shareUrl);
      },
      showUrlShortenerButton: function() {
        try {
          new URL(this.urlShortenerEndpoint);
          return true;
        } catch (err) {}
        return false;
      },
      displayUrl: function() {
        if (typeof this.shortenedUrl === 'string' && this.shortenedUrl.length > 0) {
          return this.shortenedUrl;
        }
        return this.shareUrl;
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

    mounted() {
      this.$store.commit('upload/URL_SHORTENER_ENABLED', true);
      this.$store.commit('upload/SHORTENED_URL', null)
    },

    methods: {
      newSession() {
        if (!confirm('Create a new upload session?')) return;
        document.location.reload();
      },
      shorten() {
        if (this.urlShortenerEnabled) {
          // disable the button to avoid calling shortener again
          this.$store.commit('upload/URL_SHORTENER_ENABLED', false);
          const urlShortenerEndpointWithShareUrl = this.urlShortenerEndpoint.replace('%%URL%%', this.shareUrl);
          fetch(urlShortenerEndpointWithShareUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html, application/xhtml+xml, application/xml, application/json'
            },
            mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin',
            redirect: 'follow', // manual, *follow, error
            referrerPolicy: 'no-referrer'
          }).then(response => response.text()).then(
            (result) => {
              if (typeof result === 'string' && result.length > 0) {
                const shortUrlMatcher = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
                const shortUrl = (result.match(shortUrlMatcher) || []).sort(function(a, b) {
                    return a.length - b.length;
                })[0];
                if (typeof shortUrl === 'string' && shortUrl.length > 0) {
                  this.$store.commit('upload/SHORTENED_URL', shortUrl);
                  return;
                }
              }
            }
          ).catch(
            (err) => {
              console.error(err);
              // we don't know why it failed, could be CORS of the external server not setup properly
              // in which case we attempt to open it in new tab
              window.open(
                urlShortenerEndpointWithShareUrl,
                '_blank',
                'noopener, noreferrer'
              );
            }
          );
        }
      }
    }

  }
</script>

// cannot use "scoped" here since canvas/svg is not within this component
<style>
  .qrcode canvas, .qrcode svg {
    border: 10px solid white !important;
    max-width: 50vmin;
    max-height: 50vmin;
  }
  .uploaded {
    min-height: 20px;
    padding: 19px;
    margin-bottom: 20px;
    background-color: #f5f5f5;
    border: 1px solid #e3e3e3;
    border-radius: 5px;
    box-shadow: 0 10px 75px rgba(0, 0, 0, 0.5);
  }
</style>
