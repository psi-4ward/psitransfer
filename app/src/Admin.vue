<template lang="pug">
  .download-app
    a.btn.btn-sm.btn-info.btn-admin-refresh(@click='login()', title='Refresh', v-if="loggedIn")
      icon(name="sync-alt")

    .alert.alert-danger(v-show="error")
      strong
        icon.fa-fw(name="exclamation-triangle")
        |  {{ error }}
    form.well(v-if='!loggedIn', @submit.stop.prevent="login")
      h3 Password
      .form-group
        input.form-control(type='password', v-model='password', autofocus="")
      p.text-danger(v-show='passwordWrong')
        strong Access denied!
      |
      button.btn.btn-primary(type="submit", :disabled="!password")
        icon.fa-fw(name="sign-in-alt")
        |  login

    div(v-if="loggedIn")
      table.table.table-hover
        thead
          tr
            th SID
            th Created
            th Downloaded
            th Expire
            th Size
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
        tfoot
          tr
            td(colspan="3")
            td.text-right(colspan="2") Sum: {{ humanFileSize(sizeSum) }}

</template>


<script>
  import 'vue-awesome/icons/exclamation-triangle';
  import 'vue-awesome/icons/sync-alt';
  import 'vue-awesome/icons/sign-in-alt';
  import 'vue-awesome/icons/key';


  export default {
    name: 'app',

    data () {
      return {
        db: {},
        sum: {},
        loggedIn: false,
        password: '',
        error: '',
        passwordWrong: false,
        expand: false,
        sizeSum: 0
      }
    },

    methods: {
      expandView(sid) {
        if(this.expand === sid) return this.expand = false;
        this.expand = sid;
      },

      login() {
        if(!this.password) return;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'admin/data.json');
        xhr.setRequestHeader("x-passwd", this.password);
        xhr.onload = () => {
          if(xhr.status === 200) {
            try {
              this.db = JSON.parse(xhr.responseText);
              this.loggedIn = true;
              this.error = '';
              this.passwordWrong = false;
              this.expandDb();
            }
            catch(e) {
              this.error = e.toString();
            }
          } else {
            if(xhr.status === 403) this.passwordWrong = true;
            else this.error = `${xhr.status} ${xhr.statusText}: ${xhr.responseText}`;
          }
        };
        xhr.send();
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

<style>
  .bucket {
    cursor: pointer;
  }
  .expanded {
    background: #fafafa;
  }
  .expanded .bucket td {
    font-weight: bold;
  }
  tfoot {
    font-weight: bold;
  }
</style>
