#!/usr/bin/env node

var path = require('path');
var reload = require('require-reload')(require);
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var loadSandbox = require('getsandbox-express').loadSandbox;
var express = require('express');
var spawn = require('child_process').spawn;
var chalk = require('chalk');
var chokidar = require('chokidar');
var fs = require('fs');
var treekill = require('tree-kill');

var configPath, configDir, projectRootDir, config;
var server, app;
var buildProcesses;

configPath = findConfigPath();
if (!configPath) {
  process.exit(1);
}
configDir = path.dirname(configPath);
projectRootDir = path.dirname(configDir);

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

function reloadConfig() {
  config = reload(configPath);
}
function resolvePath(filepath) {
  return path.resolve(configDir, filepath);
}

function createServer() {
  app = express();

  resolveMultiConfig(config.sandboxes).forEach(function(sandbox) {
    loadSandbox(app, resolvePath(sandbox));
  });

  app.set('app_shutdown', false);

  app.use(function(req, res, next) {
    if (app.settings.app_shutdown) {
      req.connection.setTimeout(1)
    }

    next();
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
    console.log('Standalone server started.')
  });
}

function stopServer(callback) {
  app.set('app_shutdown', true);
  server.close(callback);
}

function startBuilds() {
  buildProcesses = {};
  resolveMultiConfig(config.buildCommands).forEach(function(cmd) {
    var file;
    var args;
    var options = {
      cwd: projectRootDir
    };

    if (process.platform === 'win32') {
      file = process.env.comspec || 'cmd.exe';
      args = ['/s', '/c', '"' + cmd + '"'];
      options.windowsVerbatimArguments = true;
    } else {
      file = '/bin/sh';
      args = ['-c', cmd];
    }

    var buildProcess = spawn(file, args, options);

    var pid = buildProcess.pid;

    buildProcess.stdout.on('data', function(data) {
      process.stdout.write(data);
    });

    buildProcess.stderr.on('data', function(data) {
      process.stderr.write(data);
    });

    buildProcess.on('error', function(err) {
      console.error(chalk.red('Failed to start build command "' + cmd + '", ' + err));
    });

    buildProcesses[pid] = {
      beingKilled: false
    };
  });
}

function stopBuilds(callback) {
  var count = 0;
  for (var pid in buildProcesses) {
    if (buildProcesses.hasOwnProperty(pid)) {
      count++;
      if (!buildProcesses[pid].beingKilled) {
        buildProcesses[pid].beingKilled = true;
        treekill(pid, 'SIGTERM', function(err) {
          if (!err) {
            delete buildProcesses[pid];
          }else{
            buildProcesses[pid].beingKilled = false;
          }
        });
      }
    }
  }
  if (count !== 0) {
    setTimeout(stopBuilds.bind(null, callback), 500);
  } else {
    callback();
  }
}

var status = "shut down";

startupDaemon();

chokidar.watch(configDir)
  .on('change', function() {
    switch (status) {
    case "running":
      console.log(chalk.yellow('Shutting down standalone...'));
      status = "shutting down";
      stopBuilds(function() {
        stopServer(function() {
          console.log(chalk.yellow('Standalone shut down...'));
          status = "shut down";
        });
      });
      break;
    case "error":
      status = 'shut down';
      break;
    }
  });

function startupDaemon() {
  switch (status) {
  case "shut down":
    try {
      console.log(chalk.yellow('Restarting standalone...'));
      reloadConfig();
      createServer();
      startBuilds();
      status = "running";
    } catch (ex) {
      console.error(chalk.red('Error detected in .standalone folder:'));
      console.error(chalk.red(ex.stack));
      status = "error";
    }
    break;
  }
  setTimeout(startupDaemon, 500);
}
