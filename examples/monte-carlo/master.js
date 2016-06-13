/**
 * @file
 * A simple monte-carlo PI approximation example.
 *
 * Note 2 Things:
 * 1. This is a horribly inefficient way to approximate PI.
 * 2. Javascript's handling of numbers does not lend itself to this kind of approximation.
 *
 * However, this is a quintessential parallel programming example, so here it goes...
 *
 * The following example approximates PI using 4 different methods.
 * 1. Using a single process
 * 2. Using the workpool pattern (ideal here)
 * 3. Using the distrubuted parallel pattern
 * 4. Using the scatter pattern
 */

/* eslint-disable no-console, newline-per-chained-call */

'use strict';
const master = require('../../').Master;
const path = require('path');
const slaveJS = path.join(__dirname, 'slave.js');

const TRIALS = 10000;
const ITERATIONS = 100000;

/**
 * A simple error handler.
 * @param {Error} e The error passed to the error handler.
 * @return {undefined}
 */
function onError(e) {
  console.log(e);
  process.exit(1);
}

const startSingle = process.hrtime();
let x;
let y;
let count = 0;

// --------------------------------- SINGLE PROCESS APPROXIMATION --------------------------------- //
console.log('Starting single process PI approximation. This will take about 1.5 minutes...');

for (let i = 0; i < TRIALS * ITERATIONS; i++) {
  x = Math.random() * 2 - 1;
  y = Math.random() * 2 - 1;
  if (x * x + y * y <= 1) count++;
}

const PI_SINGLE = count / ITERATIONS / TRIALS * 4;
const endSingle = process.hrtime(startSingle);

console.log(`PI~${PI_SINGLE}, Single Process Time ${endSingle[0] * 1e3 + endSingle[1] * 1e-6} ms.`);
console.log('Single Process done... 3 second cool down...\n');

setTimeout(() => {
  // ------------------------------- WORKPOOL PROCESS APPROXIMATION ------------------------------- //
  console.log('Starting workpool process PI approximation. This will take about 10 seconds...');

  const slaves = master.create.slaves(4, slaveJS);
  const workpool = master.create.workpool(slaves);
  const startMulti = process.hrtime();

  workpool
    .while(i => (i < TRIALS))
    .do('count circumscribed', ITERATIONS)
    .then(res => {
      const PI_WORKPOOL = res.sum / ITERATIONS / TRIALS * 4;
      const endWorkpool = process.hrtime(startMulti);
      console.log(
        `PI~${PI_WORKPOOL}, Time for 4 Processes (Workpool) ${endWorkpool[0] * 1e3 + endWorkpool[1] * 1e-6} ms.`
      );
    })
    .then(() => {
      console.log('Workpool done... 3 second cool down...\n');

      setTimeout(() => {
        // ---------------------------- PARALLEL PROCESS APPROXIMATION ---------------------------- //
        console.log('Starting parallel process PI approximation. This will take about 10 seconds...');
        const parallel = master.create.parallel();
        const startParallel = process.hrtime();

        parallel
          .addTask('count circumscribed', ITERATIONS)
          .for(slaves[0])
          .addTask('count circumscribed', ITERATIONS)
          .for(slaves[1])
          .addTask('count circumscribed', ITERATIONS)
          .for(slaves[2])
          .addTask('count circumscribed', ITERATIONS)
          .for(slaves[3])
          .times(TRIALS / 4)
          .execute()
          .then(resArray => {
            const countParallel = resArray.reduce((prev, curr) => ({ sum: prev.sum + curr.sum }), { sum: 0 }).sum;
            const PI_PARALLEL = countParallel / ITERATIONS / TRIALS * 4;
            const endParallel = process.hrtime(startParallel);
            console.log(
              `PI~${PI_PARALLEL}, Time for 4 Processes (Parallel) ${endParallel[0] * 1e3 + endParallel[1] * 1e-6} ms.`
            );
          })
          .then(() => {
            console.log('Parallel done... 3 second cool down...\n');

            setTimeout(() => {
              // -------------------------- SCATTER PROCESS APPROXIMATION ------------------------- //
              console.log('Starting scatter process PI approximation. This will take about 10 seconds...');
              const scatter = master.create.scatter('count circumscribed');
              const startScatter = process.hrtime();
              const data = [];

              for (let n = 0; n < TRIALS; n++) data.push(ITERATIONS);

              scatter
                .data(...data)
                .gather(slaves)
                .then(res => {
                  const PI_SCATTER = res.sum / ITERATIONS / TRIALS * 4;
                  const endScatter = process.hrtime(startScatter);
                  console.log(
                    `PI~${PI_SCATTER}, Time for 4 Processes (Scatter) ` +
                    `${endScatter[0] * 1e3 + endScatter[1] * 1e-6} ms.`
                  );
                })
                .then(() => slaves.exit())
                .catch(onError);
            }, 3000);
          })
          .catch(onError);
      }, 3000);
    })
    .catch(onError);
}, 3000);
