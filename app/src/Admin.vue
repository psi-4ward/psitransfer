<template lang="pug">
  .download-app
    a.btn.btn-sm.btn-info.btn-admin-refresh(@click='reload()', title='Refresh', v-if="loggedIn")
      icon(name="sync-alt")

    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}

    .well(v-if='!loggedIn')
      h3 Admin access
      div(v-if="walletAuth", style="margin-bottom: 1em")
        button.btn.btn-primary(@click="connect()", :disabled="connecting")
          icon.fa-fw(name="sign-in-alt")
          |  {{ connecting ? ' Connecting…' : ' Connect wallet' }}
        p.text-muted(style="margin-top: .5em") Sign in with an authorised wallet to review transfers.
      form(v-if="passwordAuth", @submit.stop.prevent="login")
        h4(v-if="walletAuth") Or use a password
        .form-group
          input.form-control(type='password', v-model='password', placeholder='Password', autofocus="")
        button.btn(:class="walletAuth ? 'btn-default' : 'btn-primary'", type="submit", :disabled="!password")
          icon.fa-fw(name="sign-in-alt")
          |  login
      p.text-danger(v-show='passwordWrong')
        strong Access denied!

    div(v-if="loggedIn")
      .well.wallet-admin(style="margin-bottom: 1.5em")
        h4 Admin wallets
        p.text-muted Ethereum wallets allowed to open this panel.
        ul.list-unstyled(style="margin-bottom: 10px")
          li(v-for="w in wallets.env", style="margin: 4px 0")
            code {{ w }}
            span.label.label-default(style="margin-left: 8px") config
          li(v-for="w in wallets.managed", style="margin: 4px 0")
            code {{ w }}
            button.btn.btn-xs.btn-danger(style="margin-left: 8px", @click="removeWallet(w)", title="Remove wallet")
              icon(name="trash")
          li(v-if="!wallets.env.length && !wallets.managed.length", class="text-muted") No wallets configured.
        .input-group(style="max-width: 540px")
          input.form-control(type="text", v-model="newWallet", placeholder="0x... wallet address", @keydown.enter.prevent="addWallet()")
          span.input-group-btn
            button.btn.btn-success(@click="addWallet()") Add wallet
        p.text-danger(v-show="walletError", style="margin-top: 8px") {{ walletError }}
      table.table.table-hover
        thead
          tr
            th SID
            th Created
            th Downloaded
            th Expire
            th.text-right Size
            th.text-right Actions
        template(v-for="(bucket, sid) in db")
          tbody(:class="{expanded: expand===sid}")
            tr.bucket(@click="expandView(sid)")
              td
                | {{ sid }}
                icon.pull-right(name="key", v-if="sum[sid].password", title="Password protected")
              td {{ sum[sid].created | date }}
              td
                template(v-if="sum[sid].lastDownload") {{ sum[sid].lastDownload | date}}
                template(v-else="") -
              td
                template(v-if="typeof sum[sid].firstExpire === 'number'") {{ sum[sid].firstExpire | date }}
                template(v-else)  {{ sum[sid].firstExpire }}
              td.text-right {{ humanFileSize(sum[sid].size) }}
              td.text-right
                button.btn.btn-xs.btn-danger(@click.stop="deleteBucket(sid)", title="Delete transfer and free space")
                  icon(name="trash")
          tbody.expanded(v-if="expand === sid")
            template(v-for="file in bucket")
              tr.file
                td {{ file.metadata.name }}
                td {{+file.metadata.createdAt | date}}
                td
                  template(v-if="file.metadata.lastDownload") {{ +file.metadata.lastDownload | date}}
                  template(v-else="") -
                td
                  template(v-if="typeof file.expireDate === 'number'") {{ file.expireDate | date }}
                  template(v-else) {{ file.expireDate }}
                td.text-right {{ humanFileSize(file.size) }}
                td.text-right
                  button.btn.btn-xs.btn-danger(@click.stop="deleteFile(sid, file.key)", title="Delete this file")
                    icon(name="trash")
        tfoot
          tr
            td(colspan="4")
            td.text-right Sum: {{ humanFileSize(sizeSum) }}
            td

</template>

<script>
  import 'vue-awesome/icons/exclamation-triangle';
  import 'vue-awesome/icons/sync-alt';
  import 'vue-awesome/icons/sign-in-alt';
  import 'vue-awesome/icons/key';
  import 'vue-awesome/icons/trash';


  export default {
    name: 'app',

    data () {
      return {
        db: {},
        sum: {},
        loggedIn: false,
        password: '',
        token: '',
        walletAuth: false,
        passwordAuth: true,
        connecting: false,
        error: '',
        passwordWrong: false,
        expand: false,
        sizeSum: 0,
        wallets: { env: [], managed: [] },
        newWallet: '',
        walletError: ''
      }
    },

    mounted() {
      fetch('admin/auth.json')
        .then(r => r.json())
        .then(cfg => {
          this.walletAuth = !!cfg.walletAuth;
          this.passwordAuth = !!cfg.passwordAuth;
        })
        .catch(() => { this.passwordAuth = true; });
    },

    methods: {
      expandView(sid) {
        if(this.expand === sid) return this.expand = false;
        this.expand = sid;
      },

      authHeaders() {
        const h = {};
        if (this.token) h['x-admin-token'] = this.token;
        else if (this.password) h['x-passwd'] = this.password;
        return h;
      },

      loadWallets() {
        fetch('admin/wallets', { headers: this.authHeaders() })
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(d => { this.wallets = d; })
          .catch(() => {});
      },

      async addWallet() {
        const addr = (this.newWallet || '').trim();
        if (!addr) return;
        this.walletError = '';
        try {
          const res = await fetch('admin/wallets', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, this.authHeaders()),
            body: JSON.stringify({ address: addr })
          });
          if (res.ok) { this.wallets = await res.json(); this.newWallet = ''; }
          else { const d = await res.json().catch(() => ({})); this.walletError = d.error || ('Failed (' + res.status + ')'); }
        } catch (e) {
          this.walletError = (e && e.message) ? e.message : String(e);
        }
      },

      async removeWallet(addr) {
        if (!confirm('Remove this admin wallet?')) return;
        this.walletError = '';
        try {
          const res = await fetch('admin/wallets/' + encodeURIComponent(addr), {
            method: 'DELETE', headers: this.authHeaders()
          });
          if (res.ok) this.wallets = await res.json();
          else { const d = await res.json().catch(() => ({})); this.walletError = d.error || ('Failed (' + res.status + ')'); }
        } catch (e) {
          this.walletError = (e && e.message) ? e.message : String(e);
        }
      },

      // Wallet sign-in: prove ownership of an allowlisted address.
      async connect() {
        this.error = '';
        if (!window.ethereum) {
          this.error = 'No Ethereum wallet detected. Install MetaMask or a compatible wallet.';
          return;
        }
        this.connecting = true;
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          const address = accounts && accounts[0];
          if (!address) throw new Error('No account selected');
          const nres = await fetch('admin/nonce');
          if (!nres.ok) throw new Error('Could not start sign-in');
          const { nonce, message } = await nres.json();
          const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
          const lres = await fetch('admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature, nonce })
          });
          if (lres.status === 200) {
            const data = await lres.json();
            this.token = data.token;
            this.reload();
          } else if (lres.status === 403) {
            // wallet is not on the allowlist -> bounce to the landing page
            window.location.href = '/';
          } else {
            const d = await lres.json().catch(() => ({}));
            this.error = d.error || ('Sign-in failed (' + lres.status + ')');
          }
        } catch (e) {
          this.error = (e && e.message) ? e.message : String(e);
        } finally {
          this.connecting = false;
        }
      },

      login() {
        if(!this.password) return;
        this.reload();
      },

      reload() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'admin/data.json');
        const h = this.authHeaders();
        Object.keys(h).forEach(k => xhr.setRequestHeader(k, h[k]));
        xhr.onload = () => {
          if(xhr.status === 200) {
            try {
              this.db = JSON.parse(xhr.responseText);
              this.loggedIn = true;
              this.error = '';
              this.passwordWrong = false;
              this.expandDb();
              this.loadWallets();
            }
            catch(e) {
              this.error = e.toString();
            }
          } else if(xhr.status === 403) {
            if(this.token) window.location.href = '/';        // authed wallet rejected -> landing
            else if(this.passwordAuth) this.passwordWrong = true;
            else window.location.href = '/';
          } else {
            this.error = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
          }
        };
        xhr.send();
      },

      async deleteBucket(sid) {
        if(!confirm('Delete this entire transfer and free its space? This cannot be undone.')) return;
        try {
          const res = await fetch('admin/data/' + encodeURIComponent(sid), {
            method: 'DELETE', headers: this.authHeaders()
          });
          if(res.ok) this.reload();
          else this.error = `Delete failed (${res.status})`;
        } catch(e) {
          this.error = (e && e.message) ? e.message : String(e);
        }
      },

      async deleteFile(sid, key) {
        if(!confirm('Delete this file? This cannot be undone.')) return;
        try {
          const res = await fetch('admin/data/' + encodeURIComponent(sid) + '/' + encodeURIComponent(key), {
            method: 'DELETE', headers: this.authHeaders()
          });
          if(res.ok) this.reload();
          else this.error = `Delete failed (${res.status})`;
        } catch(e) {
          this.error = (e && e.message) ? e.message : String(e);
        }
      },

      expandDb() {
        this.sizeSum = 0;
        Object.keys(this.db).forEach(sid => {
          const bucketSum = {
            firstExpire: Number.MAX_SAFE_INTEGER,
            lastDownload: 0,
            created: Number.MAX_SAFE_INTEGER,
            password: false,
            size: 0
          };
          this.db[sid].forEach(file => {
            bucketSum.size += file.size;
            if(file.metadata._password) {
              bucketSum.password = true;
            }
            if(+file.metadata.createdAt < bucketSum.created) {
              bucketSum.created = +file.metadata.createdAt;
            }
            if(file.metadata.lastDownload && +file.metadata.lastDownload > bucketSum.lastDownload) {
              bucketSum.lastDownload = +file.metadata.lastDownload;
            }
            if(file.metadata.retention === 'one-time') {
              bucketSum.firstExpire = 'one-time';
              file.expireDate = file.metadata.retention;
            }
            else {
              file.expireDate = +file.metadata.createdAt + (+file.metadata.retention * 1000);
              if(bucketSum.firstExpire > file.expireDate) bucketSum.firstExpire = file.expireDate;
            }
          });
          this.sizeSum += bucketSum.size;
          this.$set(this.sum, sid, bucketSum);
        });
      },

      humanFileSize(fileSizeInBytes) {
        let i = -1;
        const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        do {
          fileSizeInBytes = fileSizeInBytes / 1024;
          i++;
        } while(fileSizeInBytes > 1024);
        return Math.max(fileSizeInBytes, 0.00).toFixed(2) + byteUnits[i];
      },

    },


  }
</script>
