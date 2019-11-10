'use strict';

const debug = require('debug')('express-idempotency');
const connect = require('connect');
const expressEnd = require('express-end');

const cache = require('./lib/cache-provider');
const generateCacheKey = require('./lib/generate-cache-key');

const queue = []
/**
 * Express middleware
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const checkMw = function (req, res, next) {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = generateCacheKey(req, idempotencyKey);
  const storedResponse = cache.get(cacheKey);

  if (!storedResponse) {
    next();
  } else {
    res.status(storedResponse.statusCode);
    res.set(storedResponse.headers);
    res.set('X-Cache', 'HIT'); // indicate this was served from cache
    res.send(storedResponse.body);
  }
}

/**
 * Express middleware to store a response against a supplied idempotency token
 * in the cache.
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next callback function
 */
function storeMw(req, res, next) {
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey) {
    if (queue.includes(idempotencyKey)) {
      setInterval(() => {
        if (!queue.includes(idempotencyKey)) {
          return checkMw(req, res, next);
        }
      }, 100)
    } else {
      queue.push(idempotencyKey)
      res.once('end', () => {
        if (idempotencyKey) {
          const responseToStore = {
            statusCode: res.statusCode,
            body: res.body,
            headers: res.headers,
          };

          const cacheKey = generateCacheKey(req, idempotencyKey);
          cache.set(cacheKey, responseToStore)
          const indexOfReq = queue.indexOf(idempotencyKey);
          queue.splice(indexOfReq, 1);
          debug('stored response against idempotency key: ', idempotencyKey);
        }
      });
      return next();
    }
  }
}

const idempotency = function () {
  const chain = connect();
  chain.use(checkMw);
  chain.use(storeMw);
  chain.use(expressEnd);
  return chain;
}

module.exports = idempotency;
