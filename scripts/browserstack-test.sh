#!/usr/bin/env bash

# Browser Buckets, note the trailing comma, slashes and blank lines
BROWSERS=(
  "browserstack:ie@11.0:Windows 10"
  "browserstack:edge@15.0:Windows 10"
  "browserstack:iPad Pro 11 2018"
  "browserstack:opera@69.0:Windows 10"
  "browserstack:firefox@75.0:Windows 10"
  "browserstack:chrome@80.0:Windows 10"
  "browserstack:safari@12.1:OS X Mojave"
)


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/..

TC=node_modules/.bin/testcafe

function err {
  >&2 echo Error: "$*"
  exit 1
}

if [[ ! -x "$TC" ]]; then
  err $TC does not exist or has not execute permissions
fi

export BROWSERSTACK_PROJECT_NAME=PsiTransfer
export BROWSERSTACK_BUILD_ID=${BROWSERSTACK_BUILD_ID:-dev}
export BROWSERSTACK_PARALLEL_RUNS=1
export BROWSERSTACK_CONSOLE=warnings

if [[ -z "$BROWSERSTACK_USERNAME" ]]; then
  err Env Var BROWSERSTACK_USERNAME is empty.
fi
if [[ -z "$BROWSERSTACK_ACCESS_KEY" ]]; then
  err Env Var BROWSERSTACK_ACCESS_KEY is empty.
fi

function abort {
  echo Aborting ...
  kill ${PID} 2>/dev/null || true
  wait ${PID}
  exit 1
}
trap abort SIGINT SIGTERM SIGHUP

export TEST_URL="http://localhost:3030"
(PSITRANSFER_PORT=3030 PROCESS_ENV=production node app)&
PID=$!
sleep 2 # Give PsiTransfer some time to start
echo PsiTransfer PID ${PID}

# Seems parallel tests with browserstack provider are buggy
EXIT_CODE=0
for BROWSER in "${BROWSERS[@]}"; do
  echo Testing "${BROWSER}" ...
  $TC \
    "${BROWSER}" \
    tests/e2e
  if [[ $? -gt 0 ]]; then
    EXIT_CODE=$?
  fi
done

kill ${PID}
wait ${PID}

exit ${EXIT_CODE}
