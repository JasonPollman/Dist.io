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
const readline = require('readline');
const lib = require('proto-lib').get('_');

let rows = 0;
let cols = 0;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});


function printMatrix(m) {
  for (let i = 0; i < rows; i++) {
    for (let n = 0; n < cols; n++) process.stdout.write(`${m[i][n].toString()._.pad(3)} `);
    process.stdout.write('\n');
  }
}

function generateMatrix(m, val) {
  for (let i = 0; i < rows; i++) {
    m.push([]);
    for (let n = 0; n < cols; n++) {
      m[i].push(val || val === 0 ? val : lib.number.randomIntInRange(0, 9));
    }
  }
}

rl.question('How many rows? ', (r) => {
  r = rows = parseInt(r, 10);
  rl.question('How many columns? ', (c) => {
    c = cols = parseInt(c, 10);

    const matrixA = [];
    const matrixB = [];

    const matrixS = [];
    generateMatrix(matrixS, 0);

    generateMatrix(matrixA);
    generateMatrix(matrixB);

    console.log('Matrix A:');
    printMatrix(matrixA);

    console.log('\nMatrix B:');
    printMatrix(matrixB);

    // ----------------------------------------------- SEQUENTIAL RUN ----------------------------------------------- //
    console.log('\nStarting sequential...');
    let start = process.hrtime();
    let sum = 0;

    for (let i = 0; i < r; i++) {
      for (let n = 0; n < c; n++) {
        for (let k = 0; k < r; k++) {
          sum = sum + matrixA[i][k] * matrixB[k][n];
        }

        matrixS[i][n] = sum;
        sum = 0;
      }
    }

    console.log('\nResults:');
    printMatrix(matrixS);

    let sEnd = process.hrtime(start);
    sEnd = parseInt((sEnd[0] * 1e9 + sEnd[1]) * 1e-6, 10);
    console.log(`Total Time Sequential: ${sEnd._.withPlaceholders()} ms.`);

    // ---------------------------------------------- DISTRIBUTED RUN ----------------------------------------------- //
    const NUMBER_OF_SLAVES = 4;
    const slaves = master.createSlaves(NUMBER_OF_SLAVES, path.join(__dirname, './slave.js'));
    start = process.hrtime();

    const matrixD = [];
    generateMatrix(matrixD, 0);
    let complete = 0;

    for (let i = 0; i < r; i++) {
      master.tell(slaves[i % NUMBER_OF_SLAVES]).to('compute', { a: matrixA[i], b: matrixB[i], i })
        .then(res => {
          console.log(res);
          matrixD[res.value.i] = res.value.result;

          if (++complete === r) {
            console.log('\nResults:');
            printMatrix(matrixD);

            sEnd = process.hrtime(start);
            sEnd = parseInt((sEnd[0] * 1e9 + sEnd[1]) * 1e-6, 10);
            console.log(`Total Time Sequential: ${sEnd._.withPlaceholders()} ms.`);
            slaves.exit();
            rl.close();
          }
        })
        .catch(e => {
          console.log(e);
          slaves.exit();
          process.exit(1);
        });
    }
  });
});
