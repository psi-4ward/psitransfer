module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (!err.status) {
    // console.error(err)
    return next(err)
  }
  if (!err.expose) return next(err)
  if (!(err instanceof Error)) return next(err)

  res.statusCode = err.status
  res.json({
    name: err.name,
    message: err.message,
    details: err.details,
  })
}
