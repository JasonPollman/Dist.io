# Dist.io
------
**Distributed programming paradigms for forking node processes.**    
An abstraction around distributed, message passing programming and their complex patterns. Makes inter-process communication easy!

> Because forks are easier than chopsticks.

## Install
---
```bash
$ npm install dist.io --save
```

## Getting Started
---
**Hello world!**

``slave.js``
```js
const slave = require('dist-io').Slave;

// A callback to be invoked when the master requests
// this task to be executed.
slave.task('say hello', (data, done) => {
  // Send back a response...
  // done *must* be called.
  done('Hello World!');
});

slave.task('say goodbye', (data, done) => {
  done('Goodbye World!');
});
```

``master.js``
```js
const master = require('dist-io').Master;
const slave = master.createSlave('./path/to/slave.js');

slave.exec('say hello')
  .then(response => {
    console.log(response.value); // 'Hello World!'
    console.log(response.error); // null
  })
  .then(() => slave.exec('say goodbye'))
  .then(response => {
    console.log(response.value); // 'Goodbye World!'
    console.log(response.error); // null
  })
  // Gracefully exit the slave processes.
  .then(() => slave.exit())
  .catch(e => { throw e; });
```

**Hello world! Multiple Slaves**

``slave.js``
```js
const slave = require('dist-io').Slave;

slave.task('say hello', (data, done) => {
  done(`Hello from ${self.id}`);
});
```

``master.js``
```js
const master = require('dist-io').Master;
// Forks 5 slave.js processes
const slaves = master.createSlaves(5, './path/to/slave.js');

// Broadcast a message to all the slaves...
master.broadcast('say hello').to(...slaves)
  // Gets back an array of responses from each process...
  .then(responses => {
    responses.forEach(response => {
      console.log(response.value); // 'Hello from [i]'
    });
  })
  // Send the message to only the slave with the id 0.
  .then(() => master.slave(0).exec('say hello'))
  .then(response => {
    console.log(response.value); // 'Hello from 0'
  })
  .then(() => slaves.exit())
  .catch(e => { throw e; });
```

## Contents
---
1. [Install](#install)
1. [Getting Started](#getting-started)
1. [Options](#options)
    - [Size Strings](#size-strings)
1. [Purging Cache](#purging-cache)
1. [Wrapping The FS Module](#wrapping-the-fs-module)
1. [Other Methods](#other-methods)
1. [Performance](#performance)
