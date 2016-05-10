/*
 * singleton config provider
 */
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var reload = require('require-reload');
var resolveMultiConfig = require('./templates/common.js').resolveMultiConfig;

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
  process.exit(1);
}
exports.configPath = findConfigPath();
exports.configDir = path.dirname(exports.configPath);
exports.projectRootDir = path.dirname(exports.configDir);

function reloadConfig() {
  exports.standaloneConfig = reload(exports.configPath);
  exports.buildSpawnArgs = resolveMultiConfig(exports.standaloneConfig.buildCommands).map(function(cmd) {
    var file;
    var args;
    var options = {
      cwd: exports.projectRootDir
    };

    if (process.platform === 'win32') {
      file = process.env.comspec || 'cmd.exe';
      args = ['/s', '/c', '"' + cmd + '"'];
      options.windowsVerbatimArguments = true;
    } else {
      file = '/bin/sh';
      args = ['-c', cmd];
    }
    return {
      file: file,
      args: args,
      options: options
    };
  });
}
exports.reloadConfig = reloadConfig;

function resolvePath(inputPath) {
  return path.resolve(exports.configDir, inputPath);
}
exports.resolvePath = resolvePath;

reloadConfig();