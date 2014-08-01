'use strict';

var EventEmitter = require('events').EventEmitter;
var finder = require('./port-finder');
var util = require('util');
var debug = require('debug')('port-manager');
var _ = require('underscore');
var f = util.format;
var Service = require('./service');

var MAX = 65535;
var min = 8000;
var max = 9000;

/**
 * Normalize a TCP ports range
 *
 * @param {Number} [from] Start port (included)
 * @param {Number} [to] End port (included)
 * @return {{from: {Number}, to: {Number}}}
 * @private
 * @ignore
 */
function normalize(from, to) {
  if (from && (isNaN(from) || from <= 0) || (to && (isNaN(to) || to <= 0))) {
    throw new Error('invalid port range: required > 0');
  }
  if ((from && from > MAX) || (to && to > MAX)) {
    throw new Error(f('invalid port range: required < %d', MAX));
  }
  if (to && to < from) {
    throw new Error('invalid port range: required max >= min');
  }
  if (!from) {
    from = min;
    to = to || max;
  } else {
    to = to || from;
  }
  return {
    from: from,
    to: to
  };
}

/**
 *
 * @class node_modules.port_manager.Manager
 * @param {Number} [heartbeat] The number of milliseconds for checking if the previous assigned port is available. The test is made for every service.
 * @return {Manager}
 * @constructor
 */
function Manager(heartbeat) {
  if (!(this instanceof Manager)) {
    return new Manager().include();
  }

  /**
   * @event error Emit when an error occurs
   * @param {String} error The error
   */
  /**
   * @event claim Emit when a claim occurs
   * @param {Service} service The new service claimed
   */
  /**
   * @event release Emit when a service is released
   * @param {Service} service The service released
   */
  EventEmitter.call(this);

  heartbeat = heartbeat || 0;

  if (isNaN(heartbeat) || heartbeat < 0) {
    throw new Error('invalid heartbeat: required >= 0');
  }

  var tcpPorts = {};

  tcpPorts.included = [];
  tcpPorts.excluded = [];

  /**
   * Include the given port or ports range
   *
   * @param {Number} [from = 8000] The port or the minimum port of a range of ports
   * @param {Number} [to = 9000]  The maximum of a range of ports
   * @chainable
   */
  this.include = function include(from, to) {
    var range = normalize(from, to);
    tcpPorts.included.push([range.from, range.to]);
    debug('included ports from %d to %d', range.from, range.to);
    return this;
  };

  var _services = [];
  /**
   * All gathered services
   *
   * @property {Array} services
   */
  Object.defineProperty(this, 'services', {
    get: function get() {
      return _services;
    },
    enumerable: true
  });

  /**
   * Exclude the given port or ports range
   *
   * @param {Number} [from = 8000] The port or the minimum port of a range of ports
   * @param {Number} [to = 9000]  The maximum of a range of ports
   * @chainable
   */
  this.exclude = function exclude(from, to) {
    var range = normalize(from, to);
    tcpPorts.excluded.push([range.from, range.to]);
    debug('excluded ports from %d to %d', range.from, range.to);
    return this;
  };

  function getAllPorts(list) {
    return _.flatten(_.map(list, function (port) {
      return _.range(port[0], port[1] + 1, 1);
    }));
  }

  function getClaimed() {
    return _.pluck(_services, 'port');
  }

  /**
   * The object with all information about the ports
   *
   * @property {Object} ports
   * @property {Array} ports.included All included ports for all given rage
   * @property {Array} ports.excluded All excluded ports for all given rage
   * @property {Array} ports.available All available ports
   * @property {Array} ports.claimed All claimed ports
   */
  Object.defineProperty(this, 'ports', {
    get: function get() {
      return {
        included: tcpPorts.included,
        excluded: tcpPorts.excluded,
        available: (function selected() {
          var allIncluded = getAllPorts(tcpPorts.included);
          var allExcluded = _.union(getAllPorts(tcpPorts.excluded), getClaimed());
          return _.difference(allIncluded, allExcluded);
        }()),
        claimed: getClaimed()
      };
    }
  });

  debug('default values min: %d, max: %d, heartbeat: %d', min, max, heartbeat);

  /**
   * Emit an event and call a callback
   *
   * @param {String} event The event to fire
   * @param {Service} service The service releated to event
   * @param {Function} [callback] The function to call
   * @param {Error|String} callback.err The error if occurred
   * @param {Service} callback.service The service
   * @private
   * @ignore
   */
  this.notify = function notify(event, service, callback) {
    debug('emit %s %o', event, {name: service.name, port: service.port});
    this.emit(event, service);
    if (callback) {
      callback(null, service);
    }
  };

  /**
   * Claim a port for a service
   *
   * @param {String} name Name of the service
   * @param {Number} [port] An optional preferred port to assign. If the port is not available, an error is returned
   * @param {Function} callback The function to execute when a port is found (or not)
   * @param {Error|String} callback.err The error if occurred
   * @param {Service} callback.service The service instance with name, port and heartbeat counter
   * @chainable
   */
  this.claim = function claim(name, port, callback) {
    var self = this;
    var service = _.findWhere(_services, { name: name });
    var portsList;

    if (_.isFunction(port)) {
      callback = port;
      port = undefined;
    }
    if (service) {
      debug('service already registered %o', {name: service.name, port: service.port});
      this.notify('claim', service, callback);
    } else {
      if (port) {
        if (isNaN(port) || port <= 0 || port > MAX) {
          throw new Error(f('invalid port: required > 0 and < %d', MAX + 1));
        }
        portsList = [port];
        debug('claim "%s" port trying %s', name, port);
      } else {
        portsList = this.ports.available;
        debug('claim "%s" port in %o excluding %o', name, this.ports.included, this.ports.excluded);
      }
      // ensure all handler are attached
      process.nextTick(function () {
        // find free port
        finder.find(portsList, function (err, found) {
          if (err) {
            self.emit('unavailable', err);
            if (callback) {
              callback(err);
            }
          } else {
            service = new Service(self, name, found, heartbeat);
            _services.push(service);
            self.notify('claim', service, callback);
          }
        });
      });
    }
    return this;
  };

  /**
   * Release a port claimed by a service
   *
   * @param {String|Number|Service} resource The resource to release found using his name, port or instance
   * @param {Function} callback The callback executed when the resource is released
   * @param {Error|String} callback.err The error if occurred
   * @param {Service} callback.service The service released
   * @chainable
   */
  this.release = function release(resource, callback) {
    var filter;
    var self = this;
    if (_.isNumber(resource)) {
      filter = { port: resource };
    } else if (_.isString(resource)) {
      filter = { name: resource };
    } else if (resource instanceof Service) {
      filter = { name: resource.name };
    } else {
      throw new Error('wrong type to release');
    }
    var service = _.findWhere(_services, filter);
    if (service) {
      clearInterval(service.heartbeat);
      _services = _.without(_services, service);
      self.notify('release', service, callback);
    }
  };

  return this;
}

util.inherits(Manager, EventEmitter);

module.exports = Manager;
