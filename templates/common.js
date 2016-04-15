if (typeof exports === 'object' && typeof exports.nodeName !== 'string' && typeof define !== 'function') {
  var define = function(factory) {
    factory(require, exports, module);
  };
}

define(function(require, exports, module) {

  function resolveMultiConfig(input) {
    if (input === null || input === undefined) {
      return [];
    } else if (Array.isArray(input)) {
      return input;
    } else if (typeof input === 'function') {
      return resolveMultiConfig(input());
    } else {
      return [input];
    }
  }

  module.exports = {
    resolveMultiConfig: resolveMultiConfig
  };
});