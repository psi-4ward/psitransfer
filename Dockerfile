FROM node:18-alpine

ENV PSITRANSFER_UPLOAD_DIR=/data \
    NODE_ENV=production

MAINTAINER Christoph Wiechert <wio@psitrax.de>

RUN apk add --no-cache tzdata

WORKDIR /app

ADD *.js package.json package-lock.json README.md /app/
ADD lib /app/lib
ADD app /app/app
ADD lang /app/lang
ADD plugins /app/plugins
ADD public /app/public

# Rebuild the frontend apps
RUN cd app && \
    NODE_ENV=dev npm ci && \
    npm run build && \
    cd .. && \
    mkdir /data && \
    chown node /data && \
    npm ci && \
    rm -rf app

EXPOSE 3000
VOLUME ["/data"]

USER node

# HEALTHCHECK CMD wget -O /dev/null -q http://localhost:3000

CMD ["node", "app.js"]
