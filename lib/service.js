'use strict';

var _ = require('underscore');
var finder = require('./port-finder');
var debug = require('debug')('port-manager:service');

// check if a port is in use
function heartbeatTest(manager) {
  var self = this;
  return function heartbeat() {
    finder.find([self.port], function (err, port) {
      if (!err && port) {
        manager.release(self);
      }
    });
  };
}

/**
 * The service to manage
 *
 * @class node_modules.port_manager.Service
 * @param {Manager} manager The manager instance that store all services
 * @param {String} name The name of the service
 * @param {Number} port The port claimed by the service
 * @param {Number} [heartbeat] The heartbeat timer
 * @constructor
 */
function Service(manager, name, port, heartbeat) {
  var _name = name;
  /**
   * @property {String} name The name of the service
   */
  Object.defineProperty(this, 'name', {
    get: function get() {
      return _name;
    },
    enumerable: true
  });
  var _port = port;
  /**
   * @property {Number} port The port claimed by the service
   */
  Object.defineProperty(this, 'port', {
    get: function get() {
      return _port;
    },
    enumerable: true
  });
  var _heartbeatInterval;
  if (heartbeat !== 0) {
    debug('set heartbeat %d', heartbeat);
    _heartbeatInterval = setInterval(heartbeatTest.call(this, manager), heartbeat);
  }
  /**
   * @property {Number} heartbeat The heartbeat counter for the periodic port checking
   */
  Object.defineProperty(this, 'heartbeat', {
    get: function get() {
      return _heartbeatInterval;
    }
  });
}

module.exports = Service;
