var loadSandbox = require('getsandbox-express').loadSandbox;
var express = require('express');
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var config = require('./config.js');
var path = require('path');
var url = require('url');
var httpProxy = require('http-proxy');
var harmon = require('harmon');
var htmlParser = require('htmlparser2');

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
    var parsedShadowUrl = url.parse(config.standaloneConfig.shadowUrl);
    var shadowPath = parsedShadowUrl.path;
    delete parsedShadowUrl.pathname;
    delete parsedShadowUrl.query;
    delete parsedShadowUrl.search;
    delete parsedShadowUrl.hash;
    var shadowHost = url.format(parsedShadowUrl);

    app.use(function(req, res, next) {
      if (req.originalUrl === shadowPath) {
        harmon([], [{
          query: 'body',
          func: function(node) {
            var nodeStream = node.createStream({"outer": true});

            var parserStream = new htmlParser.WritableStream({
              onclosetag: function(tagName){
                if(tagName === 'body'){
                  nodeStream.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.2.0/require.js"></script><script src="/.standalone/templates/shadow.js"></script>');
                }
              }
            });

            nodeStream.on('end', function(){
              nodeStream.end();
            });
            nodeStream.pipe(nodeStream);
            nodeStream.pipe(parserStream);
          }
        }], true).call(this, req, res, next);
      } else {
        next();
      }
    });

    //catch-all shadowing
    //has to be last `use()`
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