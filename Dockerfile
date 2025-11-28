FROM node:22-alpine

ENV PSITRANSFER_UPLOAD_DIR=/data \
    NODE_ENV=production

LABEL maintainer="Markus F.J.Busche <elpatron@mailbox.org>"

RUN apk add --no-cache tzdata

WORKDIR /app

ADD *.js package.json pnpm-lock.yaml README.md /app/
ADD lib /app/lib
ADD app /app/app
ADD lang /app/lang
ADD plugins /app/plugins
ADD public /app/public

# Rebuild the frontend apps using pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --no-frozen-lockfile && \
    pnpm install -C app --no-frozen-lockfile && \
    pnpm run -C app build && \
    mkdir /data && \
    chown node /data && \
    rm -rf app/node_modules && \
    rm -rf app

EXPOSE 3000
VOLUME ["/data"]

USER node

# HEALTHCHECK CMD wget -O /dev/null -q http://localhost:3000

CMD ["node", "app.js"]
