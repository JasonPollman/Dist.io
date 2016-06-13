# Dist.io
------
**Distributed programming paradigms for forked node processes.**    
An abstraction around distributed, message passing programming and their complex patterns. Makes inter-process communication easy!

> It's like async for forked node processes!

## Install
---
```bash
$ npm install dist.io --save
```

## Basic Usage
---
### Hello World    
Create a master process: ``master.js``

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
    return slave.close();       // All done, gracefully exit the slave process.
  })
  .catch(e => console.error(e));
```
Create a slave process: ``slave.js``
```js
const slave = require('dist-io').Slave;

// Callbacks to be invoked when the master requests this task to be executed.
slave
  .task('say hello', (data, done) => {
    // Send back a response...
    // Note: done *must* be called.
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
  .then(responses => console.log(responses.joinValues(', '))); // -> 'Hello from 0, Hello from 1,...'
  // Send the message to only the slave with the id 0.
  .then(() => tell(master.slave(0)).to('say hello'))
  .then(response => console.log(response.value)) // -> 'Hello from 0'
  .then(() => slaves.close())
  .catch(e => console.error(e));
```

``slave.js``
```js
const slave = require('dist-io').Slave;

slave.task('say hello', (data, done) => {
  done(`Hello from ${self.id}`);
});
```

## Contents
---
1. [Install](#install)
1. [Basic Usage](#basic-usage)
1. [Examples](#examples)
1. [Patterns](#patterns)
  - [Parallel](#parallel)
  - [Pipeline](#pipeline)
  - [Workpool](#workpool)
  - [Scatter](#scatter)
1. [Master vs. Slave?](#master-vs-slave)
1. [The SlaveChildProcess](the-slavechildprocess)
1. [Controlling Slaves](#controlling-slaves)
  - [Master#tell](#mastertell)
  - [Slave#exec](#slaveexec)
  - [Master API](#master-api)
  - [Slave API](#slave-api)
  - [Slave Child Process API](#slave-child-process-api)
  - [Metadata](#metadata)
  - [Timeouts](#timeouts)
1. [Requests](#requests)
1. [Responses](#responses)
1. [Response Arrays](#response-arrays)
1. [Full API](http://www.jasonpollman.com/distio-api/)

## Examples
**Examples are located in the [examples](https://github.com/JasonPollman/Dist.io/tree/master/examples) directory of this repo.**    
To browse the JSDOCs, checkout: [Dist.io API](http://www.jasonpollman.com/distio-api/)

## Master vs. Slave?
Dist.io is divided into two parts: the *master process* and the *slave process(es)*.    

**A master controls zero or more slave processes...**

- The master process is created when ```require('dist.io').Master``` is called and is an instance of the *Master* class.
- A slave process is created when ```require('dist.io').Slave``` is called and is an instance of the *SlaveChildProcess* class.
- The *Slave* class referenced below is the "handle" between the master and the slave child process and lives within the master process.

*Note, a process can be both a master and a slave process, however this isn't advised, and be careful not to create a circular spawn dependency!*

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

## The SlaveChildProcess

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
// and error will be sent back in the response.
// By default these are *not* errors, but ResponseErrors and will not be caught.
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
**Using the actual Slave object to perform tasks...**

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
// methods which will operate on all its slaves.
// All 3 slaves will execute 'some task', and when
// all have completed, the Promise will be resolved.
slaves.exec('some task', data, metadata).then(...);
```

### Master API
**Master#create.slave**(*{String}* **pathToSlaveJS**, *{Object=}* **options**) → *{SlaveArray}*    
Creates a new slave from the code at the given path.
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
  // If the slave throw, we can handle it here if we want.
  onUncaughtException: () => { ... }
});
```

**Master#create.slaves**(*{Number}* count, *{String}* **pathToSlaveJS**, *{Object=}* **options**) → *{SlaveArray}*    
Creates multiple slave from the code at the given path.
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
  onUncaughtException: () => { ... }
});
// Note when adding an alias using master.create.slaves,
// since all aliases must be unique, an iterator is appended to the alias
// after the first slave.
// Ex: foo, foo-1, foo-2, ...etc.
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
Attempts to resolve the given argument to a slave by:     

- If *slavesOrIdsOrAliases* is a slave, return *slavesOrIdsOrAliases*,
- else if *slavesOrIdsOrAliases* is a number, find the slave with the given id.
- else if *slavesOrIdsOrAliases* is a string, find the slave with the given alias.

```js
let slave = master.slave(slaveX);
let slave = master.slave(0);
let slave = master.slave('slave alias');
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
These are members/methods on the *Slave* object within the master process, not on the *SlaveChildProcess*.

*(Getter)* **Slave#id** → *{Number}*    
Returns the slave's id.

*(Getter)* **Slave#pid** → *{Number}*    
Returns the slave's process id.

*(Getter)* **Slave#alias** → *{Number}*    
Returns the slave's alias.

*(Getter)* **Slave#location** → *{Number}*    
Returns the slave's file location.

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

*(Setter)* **Slave#onUncaughtException** = *{Function}*    
Sets a function to handle any uncaught exceptions the slave might throw.

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
Returns the slave's id.

*(Getter)* **SlaveChildProcess#alias** → *{Number}*    
Returns the slave's alias.

**SlaveChildProcess#pause**() → *{SlaveChildProcess}*    
Pauses the slave. This means the slave is refusing to execute tasks and an error will be send back to the master for every request (even closing and shutting-down).

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

### Metadata
The optional *metadata* object passed to the *Slave#exec* and *Master#tell* methods currently accept two keys.

| Key | Default | Description |
| :-- | :-----: | :---------- |
| *timeout* | ``0``  | Sets a timeout on the request in ms.<br>If the timeout is exceeded, a *TimeoutResponse* object is resolved within the response.<br><br>If this value is non-numeric, parses to ``NaN``, or is ``<= 0`` then it will default to ``0`` (no timeout). |
| *catchAll* | ``false`` | If true, *ResponseErrors* will be treated like any error and will be **rejected** (passed to the *error* argument of any provided callback).<br><br>A ``false`` setting will force the response error to resolve, and the *Response.error* property will contain the error.

#### Examples
```js
tell(slave)
  .to('some task', 'my data', { timeout: 1000, catchAll: true })
  .then(...);

slave
  .exec('some task', null, { timeout: 0, catchAll: false })
  .then(...);
```

### Timeouts
Request timeouts can be set in 3 different ways.

1. On the master singleton (for all slaves)
1. On the slave instance (for a specific slave)
1. In the request metadata (for a specific request)

Each value overrides the next.

```js
// All in ms.
master.defaultTimeout = 3000;
someSlave.defaultTimeout = 4000;
someSlave.exec('task', data, { timeout: 5000 });
```

**By default, no timeouts are set.**    
To re-set any of the setting above, set them to ``null`` to remove the timeout.

#### Examples
```js
tell(slave)
  .to('some task', 'my data', { timeout: 1000, catchAll: true })
  .then(...);

slave
  .exec('some task', null, { timeout: 0, catchAll: false })
  .then(...);
```

## Requests
*Request* objects are abstracted away from the API and there's no explicit need to use them. However, the JSDOCs are [here](http://www.jasonpollman.com/distio-api/), if you wish to see the *Request* class.

## Responses
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

*(Getter/Setter)* **Response#data** → *{\*}*    
The data sent back from the slave child process (using *done(...)*).    
This value can be modified.

*(Getter/Setter)* **Response#value** → *{\*}*    
Alias for *Response#data*.    
This value can be modified.

*(Getter/Setter)* **Response#val** → *{\*}*    
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

## Response Arrays
Response arrays are utilized when multiple slave executions are done in parallel (i.e. when using *Master#tell* or *SlaveArray#exec* on multiple slaves). They are a sub class of *Array*, so all the standard *push*, *pop*, etc. methods exist on them.

However, they have some additionaly convenience methods/properties that make working with a collection of responses easier:

**ResponseArray#each**(*{Function}* **onValue**) → *{undefined}*
Iterates over each item in the response array. *onValue* is invoked with *value*, *key*, *parent*.

**ResponseArray#joinValues**(*{String}* **glue**) → *String*
Operates just like *Array#join*, but on all the *Response#value* properties.

**ResponseArray#sortBy**(*{String}* **property**, *{String}* [**order**='asc']) → *String*
Sorts the response array by the given *Response* object property. Any property from the *Response* class can be used here. Options for the value passed to the *order* parameter are *asc* and *desc*.

*(Getter)* **Response#errors** → *{Array<Error>}*    
Returns an array of all the errors in the response array.

*(Getter)* **Response#values** → *{Array<\*>}*    
Returns an array of all the values in the response array.

*(Getter)* **Response#sum** → *{Number|NaN}*    
Sums all the values in the response array.

*(Getter)* **Response#product** → *{Number|NaN}*    
Multiplies all the values in the response array.

*(Getter)* **Response#averageResponseTime** → *{Number}*    
Returns the average amount of time taken for each response to resolve.
