/**
 * @file
 * An example of incrementing a number 1,000,000,000 times.
 */

/* eslint-disable no-console */

'use strict';
const master = require('../../').Master;
const tell = master.tell;
const path = require('path');
const slavePath = path.join(__dirname, 'slave.js');
require('proto-lib').get('_');

/**
 * The number of times to increment a number.
 * @type {Number}
 */
const TIMES = 1000000000;

/**
 * The number of slaves to create.
 * @type {Number}
 */
const NUMBER_OF_SLAVES = 4;

let slaves;
let start;
let total;

let sEnd;
let dEnd;

// ------------------------------------------------- SEQUENTIAL RUN ------------------------------------------------- //
console.log('Starting sequential...');
start = process.hrtime();
total = 0;

for (let i = 0; i < TIMES; i++) total++;
sEnd = process.hrtime(start);
sEnd = parseInt((sEnd[0] * 1e9 + sEnd[1]) * 1e-6, 10);

console.log(`Result: ${total._.withPlaceholders()}`);
console.log(`Total Time Sequential: ${sEnd._.withPlaceholders()} ms.`);

// ------------------------------------------------ DISTRIBUTED RUN ------------------------------------------------- //
console.log('\nStarting distributed...');

start = process.hrtime();
master.create.slaves(NUMBER_OF_SLAVES, slavePath)
  .then(instances => { slaves = instances; })
  .then(() => tell(slaves).to('add', TIMES / NUMBER_OF_SLAVES))
  .then(res => {
    dEnd = process.hrtime(start);
    dEnd = parseInt((dEnd[0] * 1e9 + dEnd[1]) * 1e-6, 10);
    total = res.reduce((a, b) => ({ value: a.value + b.value }), { value: 0 });

    console.log(`Result: ${total.value._.withPlaceholders()}`);
    console.log(`Total Time Distributed: ${dEnd._.withPlaceholders()} ms.`);
    console.log(`\nSpeedup: ${(sEnd / dEnd).toFixed(2)}x`);
    slaves.exit();
  })
  .catch(e => {
    console.error(e);
    slaves.exit();
  });
