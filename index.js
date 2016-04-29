#!/usr/bin/env node
var chalk = require('chalk');
var chokidar = require('chokidar');
var config = require('./config.js');
var server = require('./server.js');
var build = require('./build.js');

var status = "shut down";

startupDaemon();

chokidar.watch(config.configDir)
  .on('change', function() {
    switch (status) {
    case "running":
      console.log(chalk.yellow('Shutting down standalone...'));
      status = "shutting down";
      build.stopBuilds(function() {
        server.stopServer(function() {
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
      config.reloadConfig();
      server.createServer();
      build.startBuilds();
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
