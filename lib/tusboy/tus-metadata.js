const toObject = require('to-object-reducer');

// return object
const base64decode = str => Buffer.from(str, 'base64').toString('utf8')
const base64encode = str => Buffer.from(str, 'utf8').toString('base64')

module.exports.decode = (str = '') => {
  const keypairs = str
    .split(',')
  // .map(s => s.trim())
  const keyvals = keypairs
    .map(s => s.split(' '))
    .filter(arr => arr.length === 2)
    .filter(([key]) => key !== '')
    .map(([key, val]) => [key, base64decode(val)])
  return keyvals.reduce(toObject, {})
}

module.exports.encode = (obj = {}) => Object
  .keys(obj)
  .map(key => [key, obj[key]])
  .map(([key, val]) => [key, base64encode(val)])
  .map(kvArr => kvArr.join(' '))
  .join(',')
