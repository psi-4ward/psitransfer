# Frontend assets are platform independent: build them once on the native
# build platform instead of under QEMU for every target architecture
FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend

WORKDIR /build/app

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app ./
RUN npm run build


FROM node:26-alpine

ENV PSITRANSFER_UPLOAD_DIR=/data \
    NODE_ENV=production

LABEL maintainer="Christoph Wiechert <wio@psitrax.de>"

RUN apk add --no-cache tzdata

WORKDIR /app

# Backend deps include native prebuilds (argon2), install for the target platform
COPY package.json package-lock.json ./
RUN npm ci && \
    npm cache clean --force && \
    mkdir /data && \
    chown node /data

COPY *.js README.md ./
COPY lib lib
COPY lang lang
COPY plugins plugins
COPY public public
COPY --from=frontend /build/public/app public/app

EXPOSE 3000
VOLUME ["/data"]

USER node

# HEALTHCHECK CMD wget -O /dev/null -q http://localhost:3000

CMD ["node", "app.js"]
