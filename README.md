# Express Idempotency

Express Middleware to allow requests to be made idempotent if client passes an idempotency key header.

## Code Example

```javascript
var idempotency = require('@royalsix/express-idempotency');
app.use(idempotency());

// if requests have the header "Idempotency-Key" header set, the middleware will check to see whether a cached response to this request has been stored

// if so, the cached response will be returned, setting the header "X-Cache": "HIT"

// if not, the request will pass to the next middleware, and the response will be stored in the cache, in order that subsequent responses with the same idempotency key can be returned from the cache.
```

## Motivation

Sometimes, it's important to ensure an HTTP request is idempotent, even if you're not using a naturally idempotent HTTP verb (like `PUT` or `DELETE`). For example, if your API charges somebody's credit card when a `POST /orders` request is made, it's important to ensure that the request is only processed once. However, gremlins like network faults etc. may cause the client to fail to receive a response. Using an Idempotency Key is one solution to this problem. [Stripe describe their solution in a blog post](https://stripe.com/blog/idempotency) which provided the inspiration for this package.

Also handling parallel or concurrent requests given the same idempotency key. If two requests happen at the same time then even before the server responds to the first, then the same result will be given for the second one as the first, and the second one will not get reprocessed.

## Installation

`npm install --save @royalsix/express-idempotency`

## Tests

`npm test`

## Contributors

Package developed by [Sterling Scott](http://royalsix.co.uk), principally by [Chris Jamieson](http://chrisjamieson.me)
Check out the fork @optimuspay/express-idempotency

## License

MIT License