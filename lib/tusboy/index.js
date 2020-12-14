const { Router } = require('express');
const tusHeaderParser = require('./tus-header-parser');
const methodOverride = require('method-override');
const cors = require('cors');

const constants = require('./constants');
const errors = require('./errors');

const errorHandler = require ('./handlers/error');
const options = require ('./handlers/options');
const head = require ('./handlers/head');
const patch = require ('./handlers/patch');
const post = require ('./handlers/post');

/**
 * Returns a route handler for Express that calls the passed in function
 * @param  {Function} fn The asynchronous the route needs to call
 * @return {Promise}
 */
function w(fn) {
  if (fn.length <= 3) {
    return function(req, res, next) {
      return fn(req, res, next).catch(next);
    };
  } else {
    return function(err, req, res, next) {
      return fn(err, req, res, next).catch(next);
    };
  }
}

const detectExtensions = (store) => {
  return [
    'create',
    () => { if (store.del) return 'delete' },
  ].filter(ele => typeof ele === 'string')
}

const versionSupported = (/* versionStr */) => true

const setTusResumableHeader = (req, res, next) => {
  res.set('Tus-Resumable', constants.TUS_VERSION)
  next()
}

// The Tus-Resumable header MUST be included in every request and
// response except for OPTIONS requests. The value MUST be the version
// of the protocol used by the Client or the Server.
const assertTusResumableHeader = (req, res, next) => {
  if (!('tusResumable' in req.tus)) {
    res.set('Tus-Version', constants.TUS_VERSION)
    return next(errors.preconditionError('Tus-Resumable header missing'))
  } else if (!versionSupported(req.tus.tusResumable)) {
    res.set('Tus-Version', constants.TUS_VERSION)
    return next(errors.preconditionError('Tus-Resumable version not supported'))
  }
  next()
}

const setCorsHeaders = cors({
  origin: true,
  exposedHeaders: constants.EXPOSED_HEADERS,
})

module.exports = (store, opts = {}) => {
  const { handleErrors = true } = opts
  const extensions = detectExtensions(store)

  const nextRouter = new Router({ mergeParams: true })
    .use(assertTusResumableHeader)
    .post('/', w(post(store, opts)))
    .head('/:uploadId', w(head(store, opts)))
    .patch('/:uploadId', w(patch(store, opts)))

  if (handleErrors) nextRouter.use(errorHandler)

  const router = new Router({ mergeParams: true })
  router
    .use(methodOverride('X-HTTP-Method-Override'))
    .use(tusHeaderParser())
    .options('*', options(extensions, opts.extraCorsMethods))
    .use(setCorsHeaders)
    .use(setTusResumableHeader)
    .use((req, res, next) => {
      if (req.method === 'GET') return next()
      return nextRouter(req, res, next)
    })

  return router
}
