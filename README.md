# Port Manager

Port Manager is a small tool to find available TCP ports within a given range or a multiple range. It is inspired to [Harbor](https://www.npmjs.org/package/harbor) module with some improvements:

- capability to add multiple ports range
- capability to exclude multiple ports range
- capability to claim a specific port for a service even if it is outside the given range
- capability to release automatically a claimed port if it is not in use anymore
- chainable.

## Installation

Port Manager can be installed via [npm](http://npmjs.org).

```sh
$ npm install port-manager
```

## Quick Start

To use `port-manager` simply `require` it and use its default port range between 8000 and 9000:

```js
var manager = require('port-manager')();

manager.claim('http', function (err, service) {
  console.log(service.port);    // 8000
  //...
});
```

The primary export is a factory, but you can also create new `Manger` instance manually:

```js
var Manager = require('port-manager');
var manager = new Manager();

manager
  .include(2000, 3000)
  .include(4000)
  .exclude(2001, 2100)
  .claim('http1')
  .claim('http2')
  ;

manager.on('claim', function (service) {
  console.log(service.name, service.port);
  // in your terminal you see two rows:
  // http1  2000
  // http2  2101
});

// other events
manager.on('release', function (service) {
  console.log('released service ' + service.name + ' at port ' + service.port);
});
```

If you want to claim a port that can be released automatically when it is not in use anymore, you can set the `heartbeat` parameter (in milliseconds) in your `Manager` constructor:

```js
var Manager = require('port-manager');
var manager = new Manager(1000);

manager
  .include(2000, 3000)
  .claim('http', function (err, service) {
    //...
  });
```

In the example above, every 1000 ms the service is verified and if its port is not in use a `release` event occur and the port is available for a next `claim`.

## API Reference

For a full documentation see the `doc` folder content.

## Tests

As usual our tests are written in the BDD styles for the [Mocha](http://visionmedia.github.com/mocha) test runner using the `should` assertion interface and the great test spies tool [Sinon](http://sinonjs.org).
To run the test simply type in your terminal:

```bash
$ npm test
```

## License

Copyright (c) 2014 Yoovant by Marcello Gesmundo. All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
     copyright notice, this list of conditions and the following
     disclaimer in the documentation and/or other materials provided
     with the distribution.
   * Neither the name of Yoovant nor the names of its
     contributors may be used to endorse or promote products derived
     from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
