FROM node:26

# Default when the builder does not inject TARGETARCH (plain `docker compose build`).
ARG TARGETARCH=amd64

# System-Tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash-completion \
    build-essential \
    ca-certificates \
    direnv \
    git \
    curl \
    jq \
    less \
    fonts-firacode fonts-font-awesome \
    iproute2 \
    iputils-ping \
    net-tools \
    nmap \
    openssh-client \
    pkg-config \
    procps \
    python3 \
    sqlite3 \
    ripgrep \
    unzip \
    vim \
    zip \
  && rm -rf /var/lib/apt/lists/*

# Install gh CLI from official release
RUN curl -sSL "https://github.com/cli/cli/releases/download/v2.88.1/gh_2.88.1_linux_${TARGETARCH}.deb" \
    -o /tmp/gh.deb && dpkg -i /tmp/gh.deb && rm /tmp/gh.deb

# Install some fancy cli tools
RUN case ${TARGETARCH} in \
        "amd64") Z_ARCH="x86_64-unknown-linux-musl" ;; \
        "arm64") Z_ARCH="aarch64-unknown-linux-musl" ;; \
    esac && \
    curl -sSL "https://github.com/zellij-org/zellij/releases/latest/download/zellij-${Z_ARCH}.tar.gz" | tar -xzC /usr/local/bin
RUN curl -sSL https://starship.rs/install.sh | sh -s -- -y

RUN chsh -s /bin/bash root
RUN mkdir -p /workspaces
COPY bashrc.local /root/.bashrc.local
RUN echo 'source /root/.bashrc.local' >> /root/.bashrc

WORKDIR /workspaces/psitransfer
