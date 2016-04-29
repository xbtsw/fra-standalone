var loadSandbox = require('getsandbox-express').loadSandbox;
var express = require('express');
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var config = require('./config.js');
var sax = require('sax');
var path = require('path');
var url = require('url');
var httpProxy = require('http-proxy');

var app, proxyServer, server;

exports.createServer = function createServer() {
  app = express();
  proxyServer = httpProxy.createProxyServer();
  app.set('app_shutdown', false);

  //shutdown cut-out
  app.use(function(req, res, next) {
    if (app.settings.app_shutdown) {
      req.connection.setTimeout(1)
    }

    next();
  });

  //sandbox routes
  resolveMultiConfig(config.standaloneConfig.sandboxes).forEach(function(sandbox) {
    loadSandbox(app, config.resolvePath(sandbox));
  });

  //static routes
  resolveMultiConfig(config.standaloneConfig.staticMappings).forEach(function(mapping) {
    app.use(mapping.virtual, express.static(config.resolvePath(mapping.disk)));
  });

  //.standalone files
  app.use('/.standalone', express.static(config.configDir));
  app.use('/.standalone/templates', express.static(path.join(__dirname, 'templates')));

  if (config.standaloneConfig.shadowUrl) {
    //catch-all shadowing
    //has to be last `use()`
    var parsedShadowUrl = url.parse(config.standaloneConfig.shadowUrl);
    var shadowPath = parsedShadowUrl.path;
    delete parsedShadowUrl.pathname;
    delete parsedShadowUrl.query;
    delete parsedShadowUrl.search;
    delete parsedShadowUrl.hash;
    var shadowHost = url.format(parsedShadowUrl);

    proxyServer.on('proxyRes', function(proxyRes, req, res) {
      if (req.originalUrl === shadowPath) {
        var xmlStream = sax.createStream(false);
        xmlStream.on('closetag', function(node){
          console.log('wei');
        });
        xmlStream.on('error', function(error){
          console.log(error);
          this._parser.error = null;
          this._parser.resume();
        });
        proxyRes.pipe(xmlStream);
      }

    });

    app.use(function(req, res) {
      proxyServer.web(req, res, {
        target: shadowHost,
        secure: false,
        changeOrigin: true
      });
    });
  } else {
    app.get('/', function(req, res) {
      res.redirect('/.standalone/templates/index.html');
    });
  }

  server = app.listen(3000, function() {
    console.log('Standalone server started.')
  });
};

exports.stopServer = function stopServer(callback) {
  app.set('app_shutdown', true);
  server.close(function() {
    proxyServer.close(callback);
  });
};