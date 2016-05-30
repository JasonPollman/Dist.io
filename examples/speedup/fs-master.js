/**
 * @file
 * An example of reading a file 1,000,000 times.
 */

/* eslint-disable no-console */

'use strict';
const fs = require('fs');
const master = require('../../').Master;
const tell = master.tell;
const path = require('path');
const slavePath = path.join(__dirname, 'slave.js');
require('proto-lib').get('_');

/**
 * The number of times to increment a number.
 * @type {Number}
 */
const TIMES = 1000000;

/**
 * The number of slaves to create.
 * @type {Number}
 */
const NUMBER_OF_SLAVES = 4;

let total = 0;

let slaves;
let start;

let sEnd;
let dEnd;

// ------------------------------------------------- SEQUENTIAL RUN ------------------------------------------------- //
console.log('Starting sequential...');
start = process.hrtime();

for (let i = 0; i < TIMES; i++) {
  const contents = fs.readFileSync('./data.txt', 'utf-8');
  total += contents.length;
}
sEnd = process.hrtime(start);
sEnd = parseInt((sEnd[0] * 1e9 + sEnd[1]) * 1e-6, 10);

console.log(`Result: ${total._.withPlaceholders()} characters`);
console.log(`Total Time Sequential: ${sEnd._.withPlaceholders()} ms.`);

// ------------------------------------------------ DISTRIBUTED RUN ------------------------------------------------- //
console.log('\nStarting distributed...');

start = process.hrtime();
total = 0;

master.create.slaves(NUMBER_OF_SLAVES, slavePath)
  .then(instances => { slaves = instances; })
  .then(() => tell(slaves).to('read file', { times: TIMES / NUMBER_OF_SLAVES, file: './data.txt' }))
  .then(res => {
    dEnd = process.hrtime(start);
    dEnd = parseInt((dEnd[0] * 1e9 + dEnd[1]) * 1e-6, 10);

    total = total = res.reduce((a, b) => ({ value: a.value + b.value }), { value: 0 }).value;
    console.log(`Result: ${total._.withPlaceholders()} characters`);
    console.log(`Total Time Distributed: ${dEnd._.withPlaceholders()} ms.`);
    console.log(`\nSpeedup: ${(sEnd / dEnd).toFixed(2)}x`);
    slaves.exit();
  })
  .catch(e => {
    console.error(e);
    slaves.exit();
  });
