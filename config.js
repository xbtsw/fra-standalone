/*
 * singleton config provider
 */
var path = require('path');
var chalk = require('chalk');
var fs = require('fs');
var reload = require('require-reload');

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

function reloadConfig() {
  exports.standaloneConfig = reload(exports.configPath);
}

exports.configPath = findConfigPath();
exports.configDir = path.dirname(exports.configPath);
exports.projectRootDir = path.dirname(exports.configDir);
exports.reloadConfig = reloadConfig;
exports.resolvePath = function resolvePath(inputPath) {
  return path.resolve(exports.configDir, inputPath);
};
reloadConfig();