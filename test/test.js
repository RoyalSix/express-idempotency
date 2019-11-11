/// <reference types="jest" />
const httpMocks = require('node-mocks-http');
const middleware = require('../index.js')();
const generateCacheKey = require('../lib/generate-cache-key');
const cache = require('../lib/cache-provider');
const express = require('express');
const request = require('request');
const app = express();
const port = 3000;
const v4 = require('uuid').v4;

describe('# Express Idempotency', function () {
  describe('request handler creation', function () {
    it('should return a function()', function () {
      expect(middleware).toEqual(expect.any(Function));
    });

    it('should accept three arguments', function () {
      expect(middleware.length).toBe(3);
    });
  });

  describe('middleware', function () {
    var req, res;
    describe('with idempotency-key header in request', function () {
      beforeEach(function (done) {
        req = httpMocks.createRequest({
          method: 'POST',
          url: '/test/path',
          headers: {
            'Idempotency-Key': 'just-a-dummy-key-1',
          },
        });

        res = httpMocks.createResponse({
          eventEmitter: require('events').EventEmitter
        });

        done();
      });

      it('stores a response to the cache', function (done) {
        middleware(req, res, function next(error) {
          if (error) {
            throw new Error(error);
          }

          // end the res
          res.once('end', function () {
            var idempotencyKey = req.get('Idempotency-Key');
            var cacheKey = generateCacheKey(req, idempotencyKey);
            var storedResponse = cache.get(cacheKey);
            expect(storedResponse).toBeTruthy();
            expect(storedResponse).toHaveProperty('statusCode');
            expect(storedResponse).toHaveProperty('body');
            expect(storedResponse).toHaveProperty('headers');

            done();
          });

          // set a dummy response status and body
          res.statusCode = 200;
          res.body = { id: 1234, description: 'Just a dummy!' };
          res.send();
        });
      });

      describe('with stored response in the cache', function () {
        var responseToStore = {
          statusCode: 403,
          body: { exampleProp: 'hey there!' },
          headers: { 'x-dummy-header': 'hip hop hoop' },
        };

        beforeEach(function (done) {
          var idempotencyKey = 'just-a-dummy-key-2';
          req = httpMocks.createRequest({
            method: 'POST',
            url: '/test/path',
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          });

          res = httpMocks.createResponse({
            eventEmitter: require('events').EventEmitter
          });

          const cacheKey = generateCacheKey(req, idempotencyKey);
          cache.set(cacheKey, responseToStore);
          done();
        });

        it('returns a stored response from the cache', function (done) {
          res.once('end', function () {
            var idempotencyKey = req.get('Idempotency-Key');
            var cacheKey = generateCacheKey(req, idempotencyKey);
            var storedResponse = cache.get(cacheKey);
            expect(storedResponse).toBeTruthy();

            var expectedHeaders = responseToStore.headers;
            expectedHeaders['x-cache'] = 'HIT'; // expect a cache header

            expect(res._getStatusCode()).toBe(responseToStore.statusCode);
            expect(res._getData()).toEqual(responseToStore.body);
            expect(res._getHeaders()).toEqual(expectedHeaders);

            done();
          });

          middleware(req, res, function next(error) {
            if (error) {
              console.log('err: ', error);
              throw new Error('Expected not to receive an error');
            }
          });
        });
      });
    });

    describe('without idempotency-key header in request', function () {
      beforeEach(function (done) {
        req = httpMocks.createRequest({
          method: 'POST',
          url: '/test/path',
          headers: {},
        });
        res = httpMocks.createResponse({
          eventEmitter: require('events').EventEmitter
        });

        done();
      });

      it('does not store a response to the cache', function (done) {
        res.once('end', function () {
          var idempotencyKey = req.get('Idempotency-Key');
          var cacheKey = generateCacheKey(req, idempotencyKey);
          var storedResponse = cache.get(cacheKey);
          expect(storedResponse).toBeFalsy();
          done();
        });

        middleware(req, res, function next(error) {
          if (error) {
            throw new Error(error);
          }

          // set a dummy response status and body
          res.status(200);
          res.send({ id: 1234, description: 'Just a dummy!' });
        });
      });
    });
  });

  describe('Simultaneous Requests ', () => {
    describe('with idempotency-key header in request', function () {
      it('should handle simultaneous requests', (done) => {
        app.use(middleware);

        app.get('/', (req, res, next) => {
          setTimeout(() => {
            res.setHeader('x-testing', v4());
            res.send();
          }, 1000);
        });

        app.listen(port, () => {
          const options = {
            url: 'http://localhost:' + port,
            headers: {
              'Idempotency-Key': 'ABCDEFG',
            }
          };
          let expected;
          const callback = jest.fn((err, res, body, done) => {
            if (!expected) {
              expected = body;
            }
            expect(body).toEqual(expected);
            if (done) {
              expect(callback).toHaveBeenCalledTimes(2);
              done();
            }
          });

          options.body = v4();
          request(options, callback);
          options.body = v4();
          request(options, (...args) => callback(...args, done));
        });
      })
    });
  })
});