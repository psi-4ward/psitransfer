#!/usr/bin/env bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

# Get the current tag or use commit hash if there's none
COMMIT=$(git log -n1 --pretty='%h' 2>/dev/null || echo current)
NAME=$(git describe --exact-match --tags $COMMIT 2>/dev/null || echo $COMMIT)


echo "### Building frontend apps"
echo "======================================================"
cd $DIR/../app
npm ci
npm run build


echo
echo "### Bundling to _releases/psitransfer-$NAME.tar.gz"
echo "======================================================"
cd $DIR/..
mkdir -p _releases

tar -czf _releases/psitransfer-$NAME.tar.gz --transform "s~^~psitransfer-$NAME/~" \
  LICENSE \
  README.md \
  Dockerfile \
  .dockerignore \
  app.js \
  cli.js \
  config.js \
  package.json \
  package-lock.json \
  docs \
  lib \
  lang \
  plugins \
  public


cd $DIR/..
#if [ -d .git ]; then
#  LAST_TAG=$(git tag | head -n 2 | tail -n 1)
#  echo
#  echo "### Changelog $LAST_TAG..HEAD"
#  echo "======================================================"
#  [ -z "$LAST_TAG" ] &&  git log --oneline || git log $LAST_TAG..HEAD --oneline
#fi
