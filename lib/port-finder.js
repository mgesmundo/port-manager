'use strict';

var net = require('net');
var _ = require('underscore');

/**
 * Check if a port is available
 *
 * @param {Number} port The port to check if available
 * @param {Function} cb Function called as result
 * @param {Error} cb.err The error if occurred
 * @param {Number} cb.port The port if available
 * @private
 * @ignore
 */
function checkPort(port, cb) {
  var server = new net.Server();
  server.on('error', function (err) {
    server.removeAllListeners();
    cb(err);
  });
  server.listen(port, function () {
    server.on('close', function () {
      server.removeAllListeners();
      cb(null, port);
    });
    server.close();
  });
}

/**
 * Find the first available port in a ports list
 *
 * @param {Array} ports The ports list to find the first available
 * @param {Function} callback Function called as result
 * @param {Error} callback.err The error if occurred
 * @param {Number} callback.port The first port available
 * @private
 * @ignore
 */
function find(ports, callback) {
  if (_.isEmpty(ports)) {
    callback(new Error('no free port available'));
  } else {
    var port = ports.shift();
    checkPort(port, function (err, found) {
      if (!err) {
        callback(null, found);
      } else {
        find(ports, callback);
      }
    });
  }
}

exports.find = find;
