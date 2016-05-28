'use strict';

require('../../lib/SlaveChildProcess');
setTimeout(() => {
  throw new Error();
}, 2000);
