/**
 * @file
 * A simple master hello world example.
 * It creates 7 slaves asyncrnously, and each will perform the "say hello"
 * task, wait for a response, then perform the "say goodbye"task.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'slave.js');
const tell = master.tell;

// Create a single slave...
const slaves = master.createSlaves(5, slaveJS);
const workpool = master.create.workpool(slaves);

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

workpool
  .do('echo', 'hello world!')
  .then(res => {
    console.log(res.value);
  })
  .catch(e => {
    console.log(e);
  });

  workpool
    .do('echo', 'hello world!')
    .then(res => {
      console.log(res.value);
    })
    .catch(e => {
      console.log(e);
    });

    workpool
      .do('echo', 'hello world!')
      .then(res => {
        console.log(res.value);
      })
      .catch(e => {
        console.log(e);
      });

      workpool
        .do('echo', 'hello world!')
        .then(res => {
          console.log(res.value);
        })
        .catch(e => {
          console.log(e);
        });
