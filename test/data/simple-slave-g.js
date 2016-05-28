'use strict';

require('../../lib/SlaveChildProcess');
setTimeout(() => {
  throw new Error('uncaught exception');
}, 2000);
