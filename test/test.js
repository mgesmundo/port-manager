/*global describe, it, before, after, beforeEach, afterEach */
'use strict';

var Manager = require('..');
var http = require('http');
var sinon = require('sinon');
var should = require('should');

describe('port-manager', function () {
  var server = http.createServer();

  before(function (done) {
    server.listen(4200, done);
  });

  after(function (done) {
    server.close(done);
  });

  describe('when configured', function () {
    it('can\'t set wrong heartbeat', function (done) {
      (function () {
        var manager = new Manager(-10);
      }).should.throw('invalid heartbeat: required >= 0');
      done();
    });
    it('can\'t set wrong ports', function (done) {
      (function () {
        var manager = new Manager();
        manager.include(-10);
      }).should.throw('invalid port range: required > 0');
      (function () {
        var manager = new Manager();
        manager.include(65536);
      }).should.throw('invalid port range: required < 65535');
      (function () {
        var manager = new Manager();
        manager.include(1024, -10);
      }).should.throw('invalid port range: required > 0');
      (function () {
        var manager = new Manager();
        manager.include(1024, 65536);
      }).should.throw('invalid port range: required < 65535');
      (function () {
        var manager = new Manager();
        manager.include(1024, 1023);
      }).should.throw('invalid port range: required max >= min');
      done();
    });
  });

  describe('when ports available', function () {
    var manager = new Manager();
    manager
      .include(4200, 4205);

    beforeEach(function () {
      manager.removeAllListeners();
    });

    it('can find the first free port', function (done) {
      var claim = sinon.spy(function (service) {
        service.name.should.equal('http');
        service.port.should.equal(4201);
      });
      var error = sinon.spy();

      manager.on('claim', claim);
      manager.on('unavailable', error);

      manager.claim('http', function (err, service) {
        should.not.exist(err);
        service.name.should.equal('http');
        service.port.should.equal(4201);
        manager.services.should.containEql({name: 'http', port: 4201});
        manager.ports.claimed.should.containEql(4201);
        claim.calledOnce.should.true;
        error.called.should.false;
        done();
      });
    });

    it('can release a port', function () {
      var release = sinon.spy(function (service) {
        service.name.should.equal('http');
        service.port.should.equal(4201);
      });

      manager.on('release', release);
      manager.release('http');

      release.calledOnce.should.true;
      manager.ports.claimed.should.not.containEql(4201);
      manager.services.should.not.containEql({name: 'http', port: 4201});
    });

    it('can claim a specific port', function (done) {
      var claim = sinon.spy(function (service) {
        service.name.should.equal('http');
        service.port.should.equal(4300);
      });
      var error = sinon.spy();

      manager.on('claim', claim);
      manager.on('unavailable', error);

      manager.claim('http', 4300, function (err, service) {
        should.not.exist(err);
        service.port.should.equal(4300);
        manager.services.should.containEql({name: 'http', port: 4300});
        manager.ports.claimed.should.containEql(4300);
        claim.calledOnce.should.true;
        error.called.should.false;
        manager.release('http');
        done();
      });
    });

    it('can claim two ports', function(done) {
      beforeEach(function () {
        manager.removeAllListeners();
      });

      var server = http.createServer();
      var claim = sinon.spy();
      var unavailable = sinon.spy();

      manager.on('claim', claim);
      manager.on('unavailable', unavailable);

      manager.claim('http', function (err, service) {
        server.listen(4201);
      });

      server.on('listening', function() {
        manager.claim('https', function (err, service) {
          should.not.exist(err);
          service.port.should.equal(4202);
          manager.services.should.containEql({name: 'https', port: 4202});
          manager.ports.claimed.should.containEql(4201);
          manager.ports.claimed.should.containEql(4202);
          claim.calledTwice.should.true;
          unavailable.called.should.false;
          server.close();
          done();
        });
      });
    });
    it('can claim two ports chaining the requests', function(done) {
      beforeEach(function () {
        manager.removeAllListeners();
      });

      var claim = sinon.spy();
      var unavailable = sinon.spy();

      manager.on('claim', claim);
      manager.on('unavailable', unavailable);

      manager
        .claim('http', function (err, service) {
          should.not.exist(err);
          service.port.should.equal(4201);
          manager.ports.claimed.should.containEql(4201);
          claim.calledOnce.should.true;
          unavailable.called.should.false;
        })
        .claim('https', function (err, service) {
          should.not.exist(err);
          service.port.should.equal(4202);
          manager.services.should.containEql({name: 'https', port: 4202});
          manager.ports.claimed.should.containEql(4201);
          manager.ports.claimed.should.containEql(4202);
          claim.calledTwice.should.true;
          unavailable.called.should.false;

          manager.release(4201);
          manager.release('https');
          done();
        });
    });
  });

  describe('when port not available', function () {
    var manager = new Manager();
    manager
      .include(4200, 4200);

    beforeEach(function () {
      manager.removeAllListeners();
    });

    it('will emit `error` and return it', function (done) {
      var claim = sinon.spy();
      var unavailable = sinon.spy();
      var expectedError = 'no free port available';

      manager.on('claim', claim);
      manager.on('unavailable', unavailable);

      manager.claim('http', function (err, service) {
        err.should.eql(expectedError);
        should.not.exist(service);
        claim.called.should.false;
        unavailable.calledOnce.should.true;
        unavailable.calledWith(expectedError);
        done();
      });
    });
  });

  describe('when ports available and auto released', function() {
    var server = http.createServer();
    var manager = new Manager(500);
    manager
      .include(4200, 4205);

    beforeEach(function () {
      manager.removeAllListeners();
    });

    it('claim a port for a service with heartbeat', function(done) {
      var claim = sinon.spy();
      var unavailable = sinon.spy();
      var release = sinon.spy(function (service) {
        service.name.should.equal('https');
        service.port.should.equal(4202);
        manager.services[0].name.should.eql('http');
      });

      manager.on('claim', claim);
      manager.on('unavailable', unavailable);
      manager.on('release', release);

      manager.claim('http', function (err, service) {
        service.name.should.equal('http');
        service.port.should.equal(4201);
        server.listen(4201);
      });

      manager.claim('https', function (err, service) {
        should.not.exist(err);
        service.port.should.equal(4202);
        manager.services.should.containEql({name: 'https', port: 4202});
        manager.ports.claimed.should.containEql(4201);
        manager.ports.claimed.should.containEql(4202);
        claim.calledTwice.should.true;
        unavailable.called.should.false;
        release.called.should.false;
        // set timer to autorelease the port
        setTimeout(function () {
          release.calledOnce.should.true;
          // close the server
          server.close(function () {
            done();
          });
        }, 600);
      });
    });
  });
});
