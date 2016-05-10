#!/usr/bin/env node
var chalk = require('chalk');
var chokidar = require('chokidar');
var config = require('./config.js');
var server = require('./server.js');
var processes = require('./processes.js');
var path = require('path');

var status = "shut down";

startupDaemon();

chokidar.watch(config.configDir)
  .on('change', function() {
    switch (status) {
    case "running":
      console.log(chalk.yellow('Shutting down standalone...'));
      status = "shutting down";
      processes.stopProcesses(function() {
          console.log(chalk.yellow('Standalone shut down...'));
          status = "shut down";
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
      config.reloadConfig();

      var spawnArgs = config.buildSpawnArgs.slice(0);
      //server
      spawnArgs.push({
        file: process.execPath,
        args: [path.join(__dirname, 'server.js')],
        options: {
          cwd: process.cwd()
        }
      });
      processes.startProcesses(spawnArgs);
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
