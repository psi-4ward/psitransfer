#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

# Get the current tag or use commit hash if there's none
NAME=$(git describe --exact-match --tags $(git log -n1 --pretty='%h') 2>/dev/null || git log -n1 --pretty='%h')

echo "Building app"
cd $DIR/../app
npm install
npm run build


echo "Bundling to _releases/psitransfer-$NAME.tar.gz"
cd $DIR/..
mkdir -p _releases

tar -czf _releases/psitransfer-$NAME.tar.gz --transform "s~^~psitransfer-$NAME/~" \
  LICENSE \
  README.md \
  Dockerfile \
  .dockerignore \
  app.js \
  config.js \
  package.json \
  docs \
  lib \
  public

echo "DONE"
