# Deployment as Systemd service 

You can also install PsiTransfer as (Linux) system service. Most distributions
use Systemd as main init system. You should **not** run PsiTransfer with root privileges!

**Preparation**

```bash
# Create a target folder for PsiTransfer
mkdir -p /opt/psitransfer
cd /opt/psitransfer

# Download and extract a prebuild
curl -sL https://github.com/psi-4ward/psitransfer/releases/download/1.1.0-beta/psitransfer-1.1.0-beta.tar.gz | tar xz --strip 1

# Install dependencies
npm install --production

# Add a user psitransfer
sudo useradd --system psitransfer
 
# Make psitransfer owner of /opt/psitransfer
sudo chown -R psitransfer:psitransfer /opt/psitransfer 
```

**Systemd unit file**

Grab the [psitransfer.service](https://github.com/psi-4ward/psitransfer/blob/master/docs/psitransfer.service)
sample file, put it in `/etc/systemd/system/` and adjust to your needs.

```bash
cd /etc/systemd/system
sudo wget https://raw.githubusercontent.com/psi-4ward/psitransfer/master/docs/psitransfer.service

# Start the service
sudo systemctl start psitransfer

# Show the status
sudo systemctl status psitransfer

# Enable autostart on boot
sudo systemctl enable psitransfer
```
