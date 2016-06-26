# Dist.io
------
**Distributed programming paradigms for forked node.js processes.**    
Dist.io is an abstraction around distributed, message passing programming and its complex patterns. It makes inter-process communication simple and allows you to fork remote processes.

> It's like async for multiple node processes!

## Install
---
```bash
$ npm install dist.io --save

# If you wist to serve as a Master Proxy Server
# and host slave processes, install globally...
$ npm install dist.io -g
```

## Basic Usage
---
### Hello World    
Start a simple slave process from the master process and log some hello world messages.    

**Create a master process:** ``master.js``    
*The master process controls IO flow, manages slave tasks, and each slave's life cycle.*

```js
const master = require('dist-io').Master;
const slave = master.createSlave('./path/to/slave.js');

master.tell(slave).to('say hello')
  .then(response => {
    console.log(response.value); // 'Hello World!'
    console.log(response.error); // null
    return master.tell(slave).to('say goodbye')
  })
  .then(response => {
    console.log(response.value); // 'Goodbye World!'
    console.log(response.error); // null
    return slave.close();        // All done, gracefully exit the slave process.
  })
  .catch(e => console.error(e));
```
**Create a slave process:** ``slave.js``    
*Slaves simply execute tasks*    

```js
const slave = require('dist-io').Slave;

slave // Add some slave tasks...
  .task('say hello', (data, done) => {
    // Sends back a response. Note: done *must* be called.
    done('Hello World!');
  })
  .task('say goodbye', (data, done) => {
    done('Goodbye World!');
  });
```

### Hello World, Multiple Slaves
``master.js``
```js
const master = require('dist-io').Master;
const tell = master.tell;

// Forks 5 slave.js processes
const slaves = master.createSlaves(5, './path/to/slave.js');

// Broadcast a message to all the slaves...
tell(slaves).to('say hello')
  .then(responses => {
    console.log(responses.joinValues(', '))
    // -> 'Hello from 0, Hello from 1, Hello from 2...'
  });
  .then(() => {
    // Send a message to only the slave with the id 0.
    return tell(master.slave(0)).to('say hello')
  })
  .then(response => console.log(response.value)) // -> 'Hello from 0'
  .then(() => slaves.close())
  .catch(e => console.error(e));
```

``slave.js``
```js
const slave = require('dist-io').Slave;

slave.task('say hello', (data, done) => {
  done(`Hello from ${slave.id}`);
});
```

### Hello World, Remote Slaves
**First start the Dist.io Master Proxy Server (``bin/distio-serve``)**
```bash
$ distio-serve --port=3000
```

Now we can use Dist.io to start and interact with slaves using our Master Proxy Server.    

``master.js``
```js
const master = require('dist-io').Master;
const tell = master.tell;

// Forks 5 slave.js processes
const slaves = master.createRemoteSlaves(5, {
  // Path to the script on the remote machine.
  // This is relative to the server's root.
  script: './path/to/slave.js',
  // The host and port to the Master Proxy Server.
  host: 'localhost:3000'
});

tell(slaves).to('say hello').then(responses => {
  /* Do something with the responses... */
  slaves.close();
});
```
**Slaves must exist on the remote machine and be installed there as well (i.e. *npm install*).**    

``slave.js``
```js
const slave = require('dist-io').Slave;

slave.task('say hello', (data, done) => {
  done(`Hello from ${slave.id}`);
});
```

## Contents
---
1. [Install](#install)
1. [Basic Usage](#basic-usage)
1. [Examples](#examples)
1. [Master vs. Slave vs. SlaveChildProcess?](#master-vs-slave-vs-slavechildprocess)
1. [Controlling Slaves](#controlling-slaves)
  - [Master#tell](#mastertell)
  - [Slave#exec](#slaveexec)
1. [Patterns](#patterns)
  - [Parallel](#parallel)
  - [Pipeline](#pipeline)
  - [Workpool](#workpool)
  - [Scatter](#scatter)
1. [API](#api)
  - [Master API](#master-api)
  - [Slave API](#slave-api)
  - [Slave Child Process API](#slave-child-process-api)
  - [SlaveArray API](#slave-array-api)
  - [Request API](#request-api)
  - [Response API](#response-api)
  - [ResponseArray API](#response-array-api)
1. [Metadata](#metadata)
1. [Timeouts](#timeouts)
1. [The Master Proxy Server](#the-master-proxy-server)
  - [Starting the Master Proxy Server](#starting-the-master-proxy-server)
  - [Configuration](#master-proxy-server-config)
1. [Remote Slaves](#remote-slaves)
  - [Connecting to Remote Slaves](#connecting-to-remote-slaves)
1. [Full API](http://www.jasonpollman.com/distio-api/)

## Examples
**Examples are located in the [examples](https://github.com/JasonPollman/Dist.io/tree/master/examples) directory of this repo.**    
To browse the JSDOCs, checkout: [Dist.io API](http://www.jasonpollman.com/distio-api/)

## Master vs. Slave vs. SlaveChildProcess?
Dist.io is divided into two logical parts: the *master process* and the *slave child process(es)*.    

**A master controls zero or more slave processes...**

- The master process is created when ```require('dist.io').Master``` is called and is an instance of the *Master* class.
- A slave child process is created when ```require('dist.io').Slave``` is called and is an instance of the *SlaveChildProcess* class.
- The *Slave* class referenced below is the "handle" between the master and the slave child process and represents a slave child process within the master process.

*Note, a process can be both a master and a slave child process, however this isn't advised (and be careful not to create a circular spawn dependency!)*

#### Example
``master.js``
```js
// This is now a master process...
const master = require('dist-io').Master;
// We can create new slaves using the master process...
const slave = master.createSlave('./path/to/slave.js');

// Tell the slave to do some stuff...
master.tell(slave).to('foo')
  .then(res => {
    // A Response object is returned, see Responses below...
    console.log(res.value);
    console.log(res.error);
  })
```

``slave.js``
```js
// This is now a slave process...
const slave = require('dist-io').Slave;
// Setup some tasks that this slave accepts...
// Note, you must call done to send resolve the request with a response.
// Any arguments passed to done are optional, and only the first is sent back.
slave
  .task('foo', (data, done) {
    /* Do some work */
    done('return some value for task foo...');
  });
  .task('bar', (data, done) {
    /* Do some work */
    done('return some value for task bar...');
  });
```

## Controlling Slaves
**Dist.io allows you to control slaves using a few different syntactic dialects.**    
Note that all return a *Promise* and accept an optional *callback* parameter (I would choose a single style, but not both). For the purposes of simplicity, the examples in this document use *Promises*.

When using [Master#tell](#mastertell) and [Slave#exec](slaveexec), a [Request](#request) will be sent to the slave.    

**Each requests contains:**

| Item | Description |
| :--- | :---------- |
| *task name* | The name of the task for the slave to perform |
| *data* | Data for the slave to use while processing the task |
| *metadata* | Options used in this request, which will also be sent to the slave process.<br>Options like the request timeout and error handling settings. |

### Master#tell
**Using the Master singleton to control slaves...**

**Master#tell**(*{...Slave|Number|String}* **slaves**)**.to**(*{String}* **taskName**, *{\*=}* **data**, *{Object=}* **metadata**, *{Function=}* **callback**) → *{Promise}*    

```js
const master = require('dist-io').Master;
const tell = master.tell;

// Forks 5 slave.js processes
const slaves = master.createSlaves(5, './path/to/slave.js');

// Tell a single slave to perform a task...
tell(slave[0]).to('some task', 'my data', { /* meta data */ }).then(...)

// Tell all 5 slaves to perform the task 'some task'...
tell(slaves).to('some task', 'my data', { /* meta data */ }).then(...)

// Or specific slaves...
tell(slave[0], slave[1], slave[3]).to('some task', 'my data', { /* meta data */ }).then(...)

// If a slave doesn't "do" a task, or doesn't "define" it,
// an error will be sent back in the response.
// By default these are *not* considered "errors", but ResponseErrors and will not be caught.
// For example...
tell(slave[0]).to('do some undefined task', { data: 1234 }, { timeout: 5000 })
  .then(res => {
    console.log(res.error); // Error: Slave #0 does not listen to task 'do some undefined task'.
  })
  .catch(e => {
    // This will not be invoked...
  })

// However, you can change this behavior by setting catchAll to true in the metadata.
tell(slave[0]).to('do some undefined task', { data: 1234 }, { timeout: 5000, catchAll: true })
  .then(res => {
    // This will not be invoked...
  })
  .catch(e => {
    console.log(e); // Error: Slave #0 does not listen to task 'do some undefined task'.
  })
```

### Slave#exec
**Using the Slave object to perform tasks...**

**Slave#exec**(*{String}* **taskName**, *{\*=}* **data**, *{Object=}* **metadata**, *{Function=}* **callback**) → *{Promise}*    

The semantics of *Slave#exec* are the same as *Master#tell*, but the syntax is slightly different.

```js
// Create some slaves...
// This will return a SlaveArray
const slaves = master.create.slaves(3, './path/to/slave.js');

slave[0].exec('some task', data, metadata).then(...);
slave[1].exec('some task', data, metadata).then(...);
slave[2].exec('some task', data, metadata).then(...);

// The SlaveArray object also has the base Slave
// methods that operate on all the slaves in the array.

// All 3 slaves will execute 'some task', and when
// all have completed, the Promise will be resolved.
slaves.exec('some task', data, metadata).then(...);
```

## Patterns
#### These are abstractions around common distributed programming patterns to make working with multiple slaves and controlling IO flow simpler.

### Parallel
**Executes a set of tasks among the given slaves (in parallel).**    
If the same slave is used twice, it's tasks will be sent immediately one after the next. So, if your slave child process is async, they will be executed in async by the slave.

```js
const parallelTask = master.create.parallel()
  .addTask('foo', data, metadata).for(slaveA)
  .addTask('bar', data, metadata).for(slaveB)
  .addTask('baz', data, metadata).for(slaveC);

// Execute the tasks...
parallelTask.execute().then( ... );

// You can re-use the same task again and again...
parallelTask.execute().then( ... );

// If you store off a reference to a task, you can remove it.
const someTaskList = master.create.parallel();
const taskFoo = someTaskList.addTask('foo', data, metadata).for(slaveA);
const taskBar = someTaskList.addTask('bar', data, metadata).for(slaveB);
const taskBaz = someTaskList.addTask('baz', data, metadata).for(slaveC);

// Execute the tasks...
someTaskList.execute().then(...);

// Remove foo, then execute again...
someTaskList
  .removeTask(taskFoo)
  .execute()
  .then( ... );
```

**Parallel Looping**    
You can call *Master.create.parallel#times* to create a parallel "loop".
```js
const slaves = master.create.slaves(5, 'path/to/slave-file.js');

master.create.parallel()
  .addTask('foo', master.slaves.leastBusyInList(slaves))
  .addTask('bar', master.slaves.leastBusyInList(slaves))
  .times(100)
  // This will send out 200 requests. Each "times" sends 2 tasks.
  .execute()
  .then(arrayOfResponseArrays => {
    // This will resolve with an Array of ResponseArrays.
    // Which will include the ResponseArray for each "time"
    // the tasks were executed.
  });
```

### Pipeline
**A pipeline is similar to async's *waterfall*.**    
A slave will execute a task, its results will then passed to another slave, etc. etc. Once all tasks in the pipeline are complete, a single response is resolved with the data from the last task in the pipeline.

The pipeline is started with some *initial* data (albeit ``undefined``), which is passed to the first task. The second task get the value returned from the first task, and so on, and so forth.

```js
master.create.pipeline()
  .addTask('task a').for(slaveA)
  .addTask('task b').for(slaveB)
  .execute(initialData)
  .then (res => {
    // initialData passed to slaveA's task a,
    // result of task a (res.value) passed to slaveB's task b
    // result of task b === res.
  });

const myOtherPipelineExample = master.create.pipeline()
  .addTask('foo').for(slaveA)
  .addTask('bar').for(slaveB);

myOtherPipelineExample.execute(/* Data to start the pipeline with */).then( ... );

// You can execute the same pipeline multiple times.
myOtherPipelineExample.execute(/* Data to start the pipeline with */).then( ... );

// You can intercept and mutate values during each step in the pipeline...
master.create.pipeline()
  .addTask('task a').for(slaveA)
  // Intercept and mutate the value before passing to b...
  .intercept((res, end) => {
    return res.value += ' intercepted just before b!'
  });
  .addTask('task b').for(slaveB)
  // Intercept and mutate the value before passing to c...
  .intercept((res, end) => {
    res.value += ' intercepted just before c!';
    if (/intercepted just before b!/.test(res.value)) {
      // Calling end breaks the pipeline and immediately resolves with
      // res.value equal to the value passed to end.
      // Task c, in this case, will never get executed.
      end('breaking pipeline before c.');
    }
  });
  .addTask('task c').for(slaveC)
  .intercept((res, end) => {
    return res.value += ' intercept before final resolution!'
  });
  .execute(initialData)
  .then (res => {
    // res.value === 'breaking pipeline before c.'
  });
```

### Workpool
**A workpool is a special kind of distributed pattern where the master chooses slaves based on availability.**    
Slaves are chosen to do tasks in an idle fist, round-robin fashion to ensure that all slaves are utilized and one slave isn't favored over another. However, if only one slave is idle and the rest are always busy, that slave will, of course, always be chosen.

The workpool always chooses the next *idle* slave in the slave list. If no slave is idle, it will wait for one to become idle before sending a task.    

Workpool tasks are queued up and sent out to as many idle slaves in the workpool at a time. The workpool pattern is often used in scenarios like the "Monte Carlo PI Approximation" program.

The workpool is created by passing in a list (or array) of slaves. Anytime a task needs execution, you call the "do" command, and the workpool will choose the best slave for the job.

**Note:** If you add a slave that doesn't subscribe to *some* task into the workpool and it's called upon to do that task, you'll get a response error (*res.error*) stating that the slave doesn't subscribe to the task.

```js
const workpool = master.create.workpool(...slaves);

// An idle slave will be chosen, or the task is deferred until a slave becomes idle.
workpool.do('task', data, metadata).then(res => {
  // res is a Response object, like always...
});

workpool.do('another task 1', data, metadata).then( ... );
workpool.do('another task 2', data, metadata).then( ... );
workpool.do('another task 3', data, { timeout: 3000 }).then( ... );
...

// You can execute a task in a "loop" using workpool's "while" predicate function.
workpool
  .while(i => (i < 30))
  .do('task', data, metadata)
  .then( ... );

workpool
  .while((i, responsesUpToNow) => {
    // Return falsy to break the loop.
    if(responsesUpToNow.values.indexOf('some value') > -1) return false;
  })
  .do('task', data, metadata)
  .then(resArray => { ... });
```

### Scatter
**Scatters the list of data arguments provided to the given slaves and task in parallel.**
The scatter pattern is useful when you have a bunch of data to process using the same task. You create the scatter bound to a specific task, and then "scatter" the data set across the given slaves.

The tasks are assigned in a round-robin fashion, and when all tasks have completed, the Promise will be resolved.

**Note, you must use the *spread* operator if you plan to scatter an array, otherwise the Array will be considered data itself.**

If you specify ``{ chunk: true }`` into the task metadata, the scatter behavior will change. Rather than round-robin sending the tasks out, it will simply split the array into ``slaveCount`` parts and send these sub-arrays to the slaves as the data.

```js
master.create.scatter('task name')
  .data('hello', 'world')
  .gather(slaveA, slaveB)
  .then(res => { ... })
  .catch(/* Handle Errors */);

// Scatter an array of data...
const myData = [1, 2, 3, 4, 5, 6, 7, 8, 9];
master.create.scatter('task name')
  .data(...myData)
  .gather(slaveA, slavesB)
  .then(res => {
    console.log(res.values.join(', '));
  })
  .catch(/* Handle Errors */);

// Tasks are assigned in a round-robin fashion, so here, slaveA
// will get both the 'a' and null data objects.
master.create.scatter('task name', { timeout: 5000, chunk: false })
  .data('a', 'b', { foo: 'bar' }, null)
  .gather(slaveA, slaveB, slaveC)
  .then(res => { ... })
  .catch(/* Handle Errors */);

// Using { chunk: true }, the data will be split up
// and sent to the slaves as arrays in equal portions.
master.create.scatter('task name', { chunk: true })
  .data(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  .gather(slaveA, slaveB)
  .then(res => {
    // res.length === 2
    // slaveA will get [1, 2, 3, 4, 5] as it's data
    // slaveB will get [6, 7, 8, 9, 10] as it's data
  })
  .catch(/* Handle Errors */);
```

#### More patterns to come...
##### Iterator, maybe?

## API

### Master API
**Master#create.slave**(*{String}* **pathToSlaveJS**, *{Object=}* **options**) → *{SlaveArray}*    
Creates a new local slave from the code at the given path.

*This is an alias for Master#createSlave*    

```js
const slave = master.create.slave('/path/to/slave.js', {
  // An alias for this slave, must be unique for each slave.
  alias: 'my slave'
  // Set a group for this slave...
  group: 'my group'
  // Arguments to pass to the slave
  args: [ ... ],
  // Options passed to ChildProcess.fork
  forkOptions: { ... },
  // If the slave throws, we can handle it here if we want.
  onUncaughtException: () => { ... }
  // If the slave fails to spawn, this listener will handle it.
  onSpawnError: () => { ... }
});
```

**Master#create.slaves**(*{Number}* count, *{String}* **pathToSlaveJS**, *{Object=}* **options**) → *{SlaveArray}*    
Creates multiple local slaves from the code at the given path.

*This is an alias for Master#createSlaves*    

```js
const slave = master.create.slaves(7, '/path/to/slave.js', {
  // An alias for the slaves, must be unique for each slave (see note below)
  alias: 'my slave'
  // Set a group for the slaves...
  group: 'my group'
  // Arguments to pass to the slaves
  args: [ ... ],
  // Options passed to ChildProcess.fork
  forkOptions: { ... },
  // If any of the slaves throw, we can handle it here if we want.
  onUncaughtException: () => { ... },
  // If any the slave fails to spawn, this listener will handle it.
  onSpawnError: () => { ... }
});
// Note when adding an alias using master.create.slaves,
// since all aliases must be unique, an iterator is appended to the alias
// after the first slave.
// Ex: foo, foo-1, foo-2, ...etc.
```

**Master#create.remote.slave**(*{String}* **remoteSlaveOptions**, *{Object=}* **options**) → *{SlaveArray}*    
Creates a remote slave. Options are the same a creating a local slaves.

*This is an alias for Master#createRemoteSlave*    

The argument passed for parameter *remoteSlaveOptions* should be an object with the following keys:    

| Key      | Description |
| :------- | :---------- |
| *host*   | The host and port of the host machine (Master Proxy Server) |
| *script* | The path to the script file **on the host machine**, relative to the server's root |
| *passphrase* | An *optional* passphrase, if the server has enabled [Basic Auth](#master-proxy-server-config) |

```js
const slave = master.create.remote.slave(
  {
    host: 'http://my.master.server:3000',
    script: '/path/to/host/script.js'
  },
  { /* Options */ }
);
```

**Master#create.remote.slaves**(*{Number}* count, *{String}* **remoteSlaveOptions**, *{Object=}* **options**) → *{SlaveArray}*    
Creates multiple remote slaves. Options are the same a creating a local slaves.

*This is an alias for Master#createRemoteSlaves*    

The argument passed for parameter *remoteSlaveOptions* should be an object with the following keys:    

| Key      | Description |
| :------- | :---------- |
| *host*   | The URL path to the host machine (Master Proxy Server) |
| *script* | The path to the script file **on the host machine** |
| *passphrase* | An *optional* passphrase, if using [Basic Auth](#basic-authorization) |

```js
const slave = master.create.remote.slaves(
  7,
  {
    host: 'http://my.master.server:3000',
    script: '/path/to/host/script.js'
  },
  { /* Options */ }
);
```

**Master#slaves.all** → *{SlaveArray}*    
Returns all *active* slaves (those which haven't been closed or killed).
```js
const allSlaves = master.slaves.all;
```

**Master#slaves.busy** → *{SlaveArray}*    
Returns all slaves that have requests pending.
```js
const busySlaves = master.slaves.busy;
```

**Master#slaves.idle** → *{SlaveArray}*    
Returns all slaves that have no requests pending ("idle"). Note idle is from the master's perspective and not the slave's. This *does not* mean the slave process is idle, only that there are no pending requests send from the master.
```js
const idleSlaves = master.slaves.idle;
```

**Master#slaves.remote** → *{SlaveArray}*    
Returns all *remote* slaves (those not started on the current machine).
```js
const remoteSlaves = master.slaves.remote;
```

**Master#slaves.local** → *{SlaveArray}*    
Returns all *local* slaves (those which have been started on the current machine).
```js
const localSlaves = master.slaves.local;
```

**Master#slaves.idleInList**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{SlaveArray}*    
Returns all slaves in the given list of slaves (and/or slave ids, and/or slave aliases) which are idle.
```js
const idleSlaves = master.slaves.idleInList(0, slaveA);
```

**Master#slaves.leastBusy**() → *{Slave}*    
Returns the "least busy" slave from all active slaves. That is, the slave with the least number of pending requests.
```js
const leastBusy = master.slaves.leastBusy();
```

**Master#slaves.inGroup**(*{String}* **group**) → *{SlaveArray}*    
Returns all slaves in the given group.
```js
const slavesInGroupFoo = master.slaves.inGroup('foo');
```

**Master#slaves.notInGroup**(*{String}* **group**) → *{SlaveArray}*    
Returns all slaves *not* in the given group.
```js
const slavesNotInGroupFoo = master.slaves.notInGroup('foo');
```

**Master#slaves.leastBusyInGroup**(*{String}* **group**) → *{Slave}*    
Returns the "least busy" slave in the given group. That is, the slave with the least number of pending requests.
```js
const leastBusyInGroupFoo = master.slaves.leastBusyInGroup('foo');
```

**Master#slaves.leastBusyInList**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{Slave}*    
Returns the "least busy" slave in the arguments list of slaves (and/or slave ids, and/or slave aliases).
```js
const leastBusyInList = master.slaves.leastBusyInList(0, 'mySlaveAlias', slaveX);
```

**Master#slaveBelongsToGroup**(*...{Slave|Number|String}* **slaveOrIdOrAlias**, *{String}* **group**) → *{Boolean}*    
Determines if slave *slaveOrIdOrAlias* belongs to group *group*. Returns true if yes, false otherwise.
```js
const slaveIsInGroupFoo = master.slaveBelongsToGroup(slaveX, 'foo');
```

**Master#getSlaveWithId**(*{Number}* **id**) → *{Slave|null}*    
Returns the slave with the given id, or null if it doesn't exist.
```js
const slaveWithId88 = master.getSlaveWithId(88);
```

**Master#getSlaveWithAlias**(*{String}* **alias**) → *{Slave|null}*    
Returns the slave with the given alias, or null if it doesn't exist.
```js
const slaveWithAlias = master.getSlaveWithAlias('my slave');
```

**Master#getSlavesWithPath**(*{String}* **filePath**) → *{SlaveArray}*    
Returns all the slaves with the given file path, or an empty *SlaveArray* if there are none.
```js
const slaveFromExample = master.getSlavesWithPath('/path/to/example.js');
```

**Master#slave**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{Slave|null}*    
Attempts to resolve the given argument to an active slave:     

- If *slavesOrIdsOrAliases* is a slave, return *slavesOrIdsOrAliases*,
- else if *slavesOrIdsOrAliases* is a number, find the slave with the given id.
- else if *slavesOrIdsOrAliases* is a string, find the slave with the given alias.

```js
slave = master.slave(slaveX);
slave = master.slave(0);
slave = master.slave('slave alias');
```

**Master#shutdown**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{Promise}*    
Waits for all pending requests to resolve, then gracefully exits all the slaves in the arguments list.
Note, once called on a slave, any requests made after the shutdown call will return a *ResponseError* indicating that the slave has been shutdown.

```js
master.shutdown(someSlave)        // Shuts down the given slave object
master.shutdown(0, 1, 2)          // Shuts down slaves with ids 0, 1, 2
master.shutdown.all()             // Shuts down all slaves
master.shutdown.group('my group') // Shuts down all slaves in group 'my group'
```

**Master#close**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{Promise}*    
Gracefully and immediately exits all the slaves in the arguments list (does not wait for all requests to resolve).
Note, once called on a slave, any requests made after the close call will return a *ResponseError* indicating that the slave has been closed.

```js
master.close(someSlave)        // Closes the given slave object
master.close(0, 1, 2)          // Closes slaves with ids 0, 1, 2
master.close.all()             // Closes all slaves
master.close.group('my group') // Closes all slaves in group 'my group'
```

**Master#kill**(*...{Slave|Number|String}* **slavesOrIdsOrAliases**) → *{Promise}*    
Forcefully, destructively and immediately exits all the slaves in the arguments list (sends *SIGKILL*).
Note, once called on a slave, any requests made after the close call will return a *ResponseError* indicating that the slave has been killed.

```js
master.kill(someSlave)        // Kills the given slave object
master.kill(0, 1, 2)          // Kills slaves with ids 0, 1, 2
master.kill.all()             // Kills all slaves
master.kill.group('my group') // Kills all slaves in group 'my group'
```

*(Getter/Setter)* **Master#defaultTimeout** = *{Number}* **timeout** → *{Number}*    
Gets/sets all slave's default request timeout. This will be overridden by any timeouts set in any request *metadata* or set by *Slave#defaultTimeout*. However, if the metadata or the slave does not specify a timeout, this will be used. If ``<= 0`` or parses to ``NaN``, no timeout will be set.

*(Getter/Setter)* **Master#shouldCatchAll** = *{Boolean}* **value** → *{Boolean}*    
Gets/sets all slave's default *catchAll* option. This will be overridden by any *catchAll* value set in the request *metadata* or by using *Slave#shouldCatchAll*. However, if the metadata or the slave does not specify a *catchAll* option, this will be used.

### Slave API
**API for both local and remote slaves**
These are members/methods on the *Slave* object within the master process, not on the *SlaveChildProcess*.

*(Getter)* **Slave#id** → *{Number}*    
Returns the slave's id.

*(Getter)* **Slave#pid** → *{Number}*    
Returns the slave's process id.

*(Getter)* **Slave#isRemote** → *{Boolean}*    
True if the slave is a remotely spawned slave (i.e. non-local).

*(Getter)* **Slave#alias** → *{String}*    
Returns the slave's alias.

*(Getter)* **Slave#location** → *{String}*    
Returns the slave's file location for local slaves, and the host for remote slaves.

*(Getter)* **Slave#path** → *{String}*    
Returns the slave's file location for both local and remote slaves.

*(Getter/Setter)* **Slave#group** = *{String}* **group** → *{String}*    
Gets/sets the slaves group.

*(Getter/Setter)* **Slave#defaultTimeout** = *{Number}* **timeout** → *{Number}*    
Gets/sets the slaves default request timeout. This will be overridden by any timeouts set in the request *metadata*. However, if the metadata does not specify a timeout, this will be used. If ``<= 0`` or parses to ``NaN``, no timeout will be set.

*(Getter/Setter)* **Slave#shouldCatchAll** = *{Boolean}* **value** → *{Boolean}*    
Gets/sets the slaves default *catchAll* option. This will be overridden by any *catchAll* value set in the request *metadata*. However, if the metadata does not specify a *catchAll* key, this will be used.

*(Getter)* **Slave#sent** → *{Number}*    
Returns the number of requests sent to the slave child process associated with this slave object.

*(Getter)* **Slave#received** → *{Number}*    
Returns the number of responses received from the slave child process associated with this slave object.

*(Getter)* **Slave#isIdle** → *{Boolean}*    
True if the slave is idle, false otherwise.

*(Getter)* **Slave#isBusy** → *{Boolean}*    
True if the slave is busy, false otherwise.

*(Getter)* **Slave#pendingRequests** → *{Boolean}*    
Returns the number of pending requests this slave is waiting for from its slave child process.

*(Getter)* **Slave#isConnected** → *{Boolean}*    
True is the slave hasn't been shutdown, killed, or closed. Indicates that the IPC channel between this process and the slave child process is still intact.

*(Getter)* **Slave#isConnected** → *{Boolean}*    
True is the slave hasn't been shutdown, killed, or closed. Indicates that the IPC channel between this process and the slave child process is still intact.

*(Getter)* **Slave#hasExited** → *{Boolean}*    
True is the slave has been closed or shutdown.

**Slave#ack**(*{Object}* **metdata**) → *{Promise}*    
Sends an acknowledgement to the slave child processes associated with this slave object.

**Slave#kill**(*{String}* [**signal**='SIGKILL']) → *{Slave}*    
Sends a signal to the slave child process.

**Slave#close**() → *{Promise}*    
Gracefully closes the slave by removing any listeners added by Dist.io so it can exit.
*Note, if you've added any event listeners or started any servers, etc. The slave will have to handle them during the SlaveChildProcess's "close requested" event or the slave won't exit.*

**Slave#shutdown**() → *{Promise}*    
Like *Slave#close*, except it waits for all pending requests to resolve before sending the *close* message to the slave.

**Slave#exec**(*{String}* **taskName**, *{\*=}* **data**, *{Object=}* **metadata**, *{Function=}* **callback**) → *{Promise}*    
Sends a message for the slave child process to execute a task.
See: [Slave#exec](#slaveexec)

### Slave Child Process API

*(Getter)* **SlaveChildProcess#id** → *{Number}*    
Returns the slave's id. This will always return the *remote* id. So if using a remote slave, this will return the id as determined from the *client*, not the master proxy server.

*(Getter)* **SlaveChildProcess#serverId** → *{Number}*    
Returns the slave's server id. That is, the slave id as it was assigned from the master proxy server.

*(Getter)* **SlaveChildProcess#remoteId** → *{Number|null}*    
Returns the slave's remote id. That is, the slave id as it was assigned from client machine (not the master proxy server). If the slave is running locally, this will be ``null``.

*(Getter)* **SlaveChildProcess#alias** → *{Number}*    
Returns the slave's alias.

*(Getter)* **SlaveChildProcess#wasProxied** → *{Boolean}*    
True if the slave was spawned by a non-local process, false otherwise.

**SlaveChildProcess#pause**() → *{SlaveChildProcess}*    
Pauses the slave. This means the slave will refuse to execute tasks and an error will be send back to the master for every request once paused (even closing and shutting-down).

**SlaveChildProcess#resume**() → *{SlaveChildProcess}*    
Un-pauses the slave, allowing the slave to again accept messages.

*(Getter)* **SlaveChildProcess#isPaused** → *{Boolean}*    
True if the slave is paused, false otherwise.

**SlaveChildProcess#task**(*{String}* **taskName**, *{Function}* **onTaskRequest**) → *{SlaveChildProcess}*    
Adds a task for this slave, and allows the master to execute this task. The *onTaskRequest* callback will be invoked when the master requests that *taskName* be completed.    

*onTaskRequest* will be invoked with the following arguments:

| Type | Name | Description |
| :--- | :--- | :---------- |
| *{\*}* | **data** | Data sent from the slave with the task instruction. |
| *{Function}* | **done** | A callback that **must** be invoked when the task is complete. The first argument to done will be sent back to the master in the response as *Response#value* |
| *{Object}* | **metadata** | The metadata from the request. |
| *{Object}* | **message** | A copy of the original request object. |

**If *onTaskRequest* throws, or *done* is invoked with an Error, the response will contain an error.**     
That is, *Response#error* will be populated with the error and *Response#value* will not.

### SlaveArray API

*(Getter)* **SlaveArray#random** → *{Slave}*    
Returns a random slave from the array.

*(Getter)* **SlaveArray#each**(*{Function}* **onValue**) → *{undefined}*    
Iterate over the slaves in the array.

**SlaveArray#exec**(*{String}* **task**, *{*\*=*}* **data**, *{*\*=*}* **metadata**) → *{Promise}*    
Broadcast a command to all of the slaves in the array and resolve the promies when all tasks are complete.

**SlaveArray#do**(*{String}* **task**, *{*\*=*}* **data**, *{*\*=*}* **metadata**) → *{Promise}*    
*An alias for SlaveArray#exec*

**SlaveArray#kill**(*{String}* [**signal**='SIGKILL']) → *{Slave}*    
Kills all the slaves in the array.

**SlaveArray#close**() → *{Promise}*    
Gracefully closes all of the slaves by removing any listeners added by Dist.io so it can exit.

**SlaveArray#shutdown**() → *{Promise}*    
Like *SlaveArray#close*, except it waits for all pending requests to resolve before sending the *close* message to each slave.

**SlaveArray#on**(*{String}* **event**, *{Function}* **listener**) → *{Promise}*    
Attaches the callback ``listener`` to the event ``event`` for every slave in the array.

### Request API
*Request* objects are abstracted away from the API and there's no explicit need to use them. However, the JSDOCs are [here](http://www.jasonpollman.com/distio-api/), if you wish to see the *Request* class.

### Response API
A *Response* is the object that's resolved by every request using *Master#tell* and *Slave#exec*.

*(Getter)* **Response#from** → *{Number}*    
Returns the id of the slave child process that sent the response.

*(Getter)* **Response#slave** → *{Slave}*    
Returns the slave object associated with the slave child process that sent the response.

*(Getter)* **Response#rid** → *{Number}*    
Returns the request id associated with this response.

*(Getter)* **Response#request** → *{Object}*    
Returns a *Request like* object, which represents the request associated with this response.

*(Getter)* **Response#id** → *{Number}*    
Returns the response (transmit) id for this response.

*(Getter)* **Response#duration** → *{Number}*    
Returns the length of time it took to resolve the response's request.

*(Getter)* **Response#received** → *{Number}*    
The timestamp of when this response was received from the slave child process.

*(Getter)* **Response#sent** → *{Number}*    
The timestamp of when the request associated with this response was sent.

*(Getter)* **Response#command** → *{String}*    
The name of the task (or command) that was completed for this response.

*(Getter/Setter)* **Response#error** → *{Error|null}*    
A *ResponseError*, if once occurred while the request was being completed.    
This value can be modified.

*(Getter/Setter)* **Response#data** → *{*\**}*    
The data sent back from the slave child process (using *done(...)*).    
This value can be modified.

*(Getter/Setter)* **Response#value** → *{*\**}*    
Alias for *Response#data*.    
This value can be modified.

*(Getter/Setter)* **Response#val** → *{*\**}*    
Alias for *Response#data*.    
This value can be modified.

**Response#pipe**(*{String}* **task**, *{Object=}* **metadata**)**.to**(*{...Slave}* **slaves**) → *{Promise}*
Pipes a response's value as the data to another slave's task.

```js
tell(slaveA).to('foo')
  .then(res => res.pipe('bar').to(slaveB))
  .then(res => res.pipe('baz').to(slaveA))
  .then(res => { ... });
```

### ResponseArray API
Response arrays are utilized when multiple slave executions are done in parallel (i.e. when using *Master#tell* or *SlaveArray#exec* on multiple slaves). They are a sub class of *Array*, so all the standard *push*, *pop*, etc. methods exist on them.

However, they have some additional convenience methods/properties that make working with a collection of responses easier:

**ResponseArray#each**(*{Function}* **onValue**) → *{undefined}*    
Iterates over each item in the response array. *onValue* is invoked with *value*, *key*, *parent*.

**ResponseArray#joinValues**(*{String}* **glue**) → *String*    
Operates just like *Array#join*, but on all the *Response#value* properties.

**ResponseArray#sortBy**(*{String}* **property**, *{String}* [**order**='asc']) → *String*   
Sorts the response array by the given *Response* object property. Any property from the *Response* class can be used here. Options for the value passed to the *order* parameter are *asc* and *desc*.

*(Getter)* **Response#errors** → *{Array<Error>}*    
Returns an array of all the errors in the response array.

*(Getter)* **Response#values** → *{Array<*\**>}*    
Returns an array of all the values in the response array.

*(Getter)* **Response#sum** → *{Number|NaN}*    
Sums all the values in the response array.

*(Getter)* **Response#product** → *{Number|NaN}*    
Multiplies all the values in the response array.

*(Getter)* **Response#averageResponseTime** → *{Number}*    
Returns the average amount of time taken for each response to resolve.

## Metadata
The optional *metadata* object passed to the *Slave#exec* and *Master#tell* methods currently accepts two keys.

| Key | Default | Description |
| :-- | :-----: | :---------- |
| *timeout* | ``0``  | Sets a timeout on the request in ms.<br>If the timeout is exceeded, a *TimeoutResponse* object is resolved within the response.<br><br>If this value is non-numeric, parses to ``NaN``, or is ``<= 0`` then it will default to ``0`` (no timeout). |
| *catchAll* | ``false`` | If true, *ResponseErrors* will be treated like any error and will be **rejected** (passed to the *error* argument of any provided callback).<br><br>A ``false`` setting will force the response error to resolve, and the *Response.error* property will contain the error.

### Examples
```js
tell(slave)
  .to('some task', 'my data', { timeout: 1000, catchAll: true })
  .then(...);

slave
  .exec('some task', null, { timeout: 0, catchAll: false })
  .then(...);
```

## Timeouts
Request timeouts can be set in 3 different ways.

1. On the master singleton (for all slaves and all requests)
1. On the slave instance (for a specific slave)
1. In the request metadata (for a specific request)

Each subsequent value overrides the next.

```js
// All in ms.
master.defaultTimeout = 3000;
someSlave.defaultTimeout = 4000;
someSlave.exec('task', data, { timeout: 5000 });
```

**By default, no timeouts are set.**    
To re-set any of the settings above, set them to ``null`` or ``0`` to remove the timeout.

#### Examples
```js
tell(slave)
  .to('some task', 'my data', { timeout: 1000, catchAll: true })
  .then(...);

slave
  .exec('some task', null, { timeout: 0, catchAll: false })
  .then(...);
```

## The Master Proxy Server
**Is just a fancy name for a socket.io server, that passes messages back and forth between a client and a host machine.**    

It's what enables Dist.io to start processes on remote machines. The master proxy server works by accepting messages to start/interact with/stop slaves. The server executes these actions and proxies the results back to your local machine. Simple as that.    

**The power of distributed computing!**    
You can run the master proxy server from a multitude of machines and distribute computationally expensive tasks among them!

### Starting the Master Proxy Server
**All CLI arguments are optional.**    
The default port is ``1337``.   

```bash
$ distio-seve --port=[port] --logLevel=[0-5] --config=[/path/to/config/file.json]
```
### Master Proxy Server Config
```js
{
  // The logging verbosity level.
  "logLevel": 5,
  // The port to start the server on.
  "port": 1337,
  // The root path to the scripts directory to fork from.
  // All remote forks will be relative to this path.
  "root": ".",
  // A set of optional credentials for basic authorization.
  // If passphrase is unspecified, basic base64 encoding
  // will be used. Otherwise AES256 encryption.
  "basicAuth": {            
    "username": "username",
    "password": "password",
    "passphrase": "secret"
  },
  // An array of string IPs or regular expression
  // strings for IP matching. If unspecified,
  // all IPs will be allowed to connect.
  "authorizedIps": [
    "192\\.168\\.0\\.\\d{1,3}",
  ],
  // The maximum number of slaves to execute concurrently
  // If unspecified, Number.MAX_VALUE will be used.
  // If this value is <= 0, then the default will be used.
  "maxConcurrentSlaves": 8,
  // The maximum amount of time a slave is allowed
  // to run (in ms) before killing it with SIGKILL
  // Default is 900000 (15 minutes).
  "killSlavesAfter": 900000
}
```

**See [serve-default-config.js](https://github.com/JasonPollman/Dist.io/blob/master/serve-default-config.json) for the default config file.**


## Remote Slaves
**Remote slaves use the same API as local slaves...**    
There are a few caveats about using them, however:    

- A [Master Proxy Server](#the-master-proxy-server) must be running on the host machine.
- The script must exist on the host machine and be *npm installed* there.
- You must use [Master#create.remote.slave(s)](#master-api) to start them.
- The cannot pass file descriptors to remote slaves.

### Remote Slave API
*RemoteSlave* class extends the *Slave* class, therefore the API between regular slaves and remote slaves is the same, with the following additions.

*(Getter)* **RemoteSlave#socket** → *{Socket}*    
Returns the slave's *socket.io* reference.

### Connecting To Remote Slaves

#### No Authentication
```js
  const slave = master.create.remote.slave({
    host: 'http://my-master-server:3000',
    script: 'slave.js'
  });
```

#### Basic Auth, No Passphrase
```js
  const slave = master.create.remote.slave({
    host: 'http://username:password@my-master-server',
    script: 'slave.js'
  });
```

#### Basic Auth and Passphrase
```js
  const slave = master.create.remote.slave({
    host: 'http://username:password@my-master-server:3000',
    script: 'slave.js',
    passphrase: 'secret passphrase'
  });
```
