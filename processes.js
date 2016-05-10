var config = require('./config.js');
var chalk = require('chalk');
var treekill = require('tree-kill');
var spawn = require('child_process').spawn;

var processes;

exports.startProcesses = function startProcesses(spawnArgs) {
  processes = {};
  spawnArgs.forEach(function(spawnArg) {
    var commandProcess = spawn(spawnArg.file, spawnArg.args, spawnArg.options);
    var pid = commandProcess.pid;

    commandProcess.stdout.on('data', function(data) {
      process.stdout.write(data);
    });

    commandProcess.stderr.on('data', function(data) {
      process.stderr.write(data);
    });

    commandProcess.on('error', function(err) {
      console.error(chalk.red('Failed to start build command "' + cmd + '", ' + err));
    });

    processes[pid] = {
      beingKilled: false
    };
  });
};

exports.stopProcesses = function stopProcesses(callback) {
  var count = 0;
  for (var pid in processes) {
    if (processes.hasOwnProperty(pid)) {
      count++;
      if (!processes[pid].beingKilled) {
        processes[pid].beingKilled = true;
        (function(pid) {
          treekill(pid, 'SIGTERM', function(err) {
            if (!err) {
              delete processes[pid];
            } else {
              processes[pid].beingKilled = false;
            }
          });
        })(pid);
      }
    }
  }
  if (count !== 0) {
    setTimeout(stopProcesses.bind(null, callback), 500);
  } else {
    callback();
  }
};