var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;
var config = require('./config.js');
var chalk = require('chalk');
var treekill = require('tree-kill');
var spawn = require('child_process').spawn;

var buildProcesses;

exports.startBuilds = function startBuilds() {
  buildProcesses = {};
  resolveMultiConfig(config.standaloneConfig.buildCommands).forEach(function(cmd) {
    var file;
    var args;
    var options = {
      cwd: config.projectRootDir
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
};

exports.stopBuilds = function stopBuilds(callback) {
  var count = 0;
  for (var pid in buildProcesses) {
    if (buildProcesses.hasOwnProperty(pid)) {
      count++;
      if (!buildProcesses[pid].beingKilled) {
        buildProcesses[pid].beingKilled = true;
        treekill(pid, 'SIGTERM', function(err) {
          if (!err) {
            delete buildProcesses[pid];
          } else {
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
};