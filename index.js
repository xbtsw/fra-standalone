#!/usr/bin/env node

var path = require('path');
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var loadSandbox = require('getsandbox-express').loadSandbox;
var express = require('express');
var spawn = require('child_process').spawn;
var chalk = require('chalk');
var chokidar = require('chokidar');
var fs = require('fs');

var server;
var buildProcesses;


var configPath = findConfigPath();
if (!configPath) {
  process.exit(1);
}
var configDir = path.dirname(configPath);
var config = require(configPath);

function findConfigPath() {
  var currentDir = path.resolve(process.cwd());
  var nextDir = path.dirname(currentDir);
  while (nextDir !== currentDir) {
    var standaloneFile = path.join(currentDir, '.standalone', 'standalone.json');
    try {
      fs.accessSync(standaloneFile, fs.F_OK | fs.R_OK);
      return standaloneFile;
    } catch (ex) {
      //ignored
    }

    currentDir = nextDir;
    nextDir = path.dirname(currentDir);
  }
  console.error(chalk.red('Failed to find valid .standalone folder'));
}

function resolvePath(filepath) {
  return path.resolve(configDir, filepath);
}

function createServer() {
  var app = express();

  resolveMultiConfig(config.sandboxes).forEach(function(sandbox) {
    loadSandbox(app, resolvePath(sandbox));
  });

  //load static folder
  resolveMultiConfig(config.staticMappings).forEach(function(mapping) {
    app.use(mapping.virtual, express.static(resolvePath(mapping.disk)));
  });

  //standalone specific
  app.use('/.standalone', express.static(configDir));
  app.use('/.standalone/templates', express.static(path.join(__dirname, 'templates')));

  app.get('/', function(req, res) {
    res.redirect('/.standalone/templates/index.html');
  });

  server = app.listen(3000, function() {
    console.log('Standalone started.')
  });
}

function stopServer(callback) {
  server.close(callback);
}

function startBuilds() {
  buildProcesses = {};
  resolveMultiConfig(config.buildCommands).forEach(function(cmd) {
    var shell;
    if (/win32/.test(process.platform)) {
      shell = 'cmd.exe';
      cmd = ['/s', '/c'].concat(cmd.split(' '));
    } else {
      shell = 'sh';
      cmd = ['-c'].concat(cmd.split(' '));
    }
    var buildProcess = spawn(shell, cmd, {
      shell: true,
      cwd: configDir
    });

    var pid = buildProcess.pid;

    buildProcess.stdout.on('data', function(data) {
      process.stdout.write(data);
    });

    buildProcess.stderr.on('data', function(data) {
      process.stderr.write(data);
    });

    buildProcess.on('close', function() {
      delete buildProcesses[pid];
    });

    buildProcess.on('error', function(err) {
      console.error(chalk.red('Failed to start build command "' + cmd + '", ' + err));
    });

    buildProcesses[pid] = buildProcess;
  });
}

function stopBuilds(callback) {
  var count = 0;
  for (var key in buildProcesses) {
    if (buildProcesses.hasOwnProperty(key)) {
      count++;
      buildProcesses[key].kill();
    }
  }
  if (count !== 0) {
    setInterval(stopBuilds.bind(null, callback), 500);
  } else {
    callback();
  }
}

startBuilds();
createServer();

chokidar.watch(configDir)
  .on('change', function() {
    console.log(chalk.yellow('.standalone change detected, refreshing...'));
    stopBuilds(function() {
      stopServer(function() {
        startBuilds();
        createServer();
      });
    });
  });