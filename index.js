#!/usr/bin/env node

var path = require('path');
var configPath = path.resolve('./.standalone/standalone.json');
var config = require(configPath);
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var loadSandbox = require('getsandbox-express').loadSandbox;
var express = require('express');

var exec = require('child_process').exec;

var app;

function resolvePath(filepath) {
  return path.resolve(path.dirname(configPath), filepath);
}

function createServer() {
  app = express();

  resolveMultiConfig(config.sandboxes).forEach(function(sandbox) {
    loadSandbox(app, resolvePath(sandbox));
  });

  //load static folder
  resolveMultiConfig(config.staticMappings).forEach(function(mapping) {
    app.use(mapping.virtual, express.static(resolvePath(mapping.disk)));
  });

  //standalone specific
  app.use('/.standalone', express.static(path.dirname(configPath)));
  app.use('/.standalone/templates', express.static(path.join(__dirname, 'templates')));

  app.get('/', function(req, res) {
    res.redirect('/.standalone/templates/index.html');
  });

  app.listen(3000, function() {
    console.log('Standalone started.')
  });
}

function runBuild() {
  resolveMultiConfig(config.buildCommands).forEach(function(cmd) {
    exec(cmd, function(error, stdout) {
      if (error) {
        throw error;
      }
      console.log(stdout);
    });
  });
}

runBuild();
createServer();
