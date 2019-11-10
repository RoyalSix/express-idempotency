const LRU = require('lru-cache');

const CACHE_MAX_AGE = 2 * 24 * 60 * 60 * 1000; // 48 hours

const lruOptions = {
  max: 500,
  length: function (n, key) { return n * 2 + key.length },
  maxAge: CACHE_MAX_AGE
};

const cache = LRU(lruOptions);

module.exports = cache;