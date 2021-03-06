# Dist.io Examples

**Broadcasting**   
An example of sending messages to multiple processes and collecting the results. Examples of *Master#shutdown.all* (shutting down all slaves), *Master#tell* and *Slave#exec*.

**Hello World**   
Some simple hello world examples. Examples of creating single and multiple slave processes, then exiting them.

**Local-Remote**    
An example of starting both local and remote slaves and executing tasks with them.

**Monte-Carlo**    
The *Monte-Carlo PI Approximation* program. Examples of Dist.io's *workpool* pattern using *while*, *parallel* pattern using *times* and the *scatter* pattern. Shows timing of each vs. single process time.

**Parallel**    
An example of the Dist.io *parallel* pattern. Examples of adding/removing tasks to/from a parallel object. Examples of sorting *ResponseArrays* and joining their values.

**Pipeline**    
An example of the Dist.io *pipeline* pattern. Examples of adding/removing tasks to/from a pipeline object. Examples of *intercepting* and mutating values throughout the pipeline; example of *Master#close.all* (closing all slaves).

**Piping**    
An example of piping a response from a task to another slave's task. Examples of *Master#tell*.

**Remote**    
An example of starting a remote slave and executing tasks with it.

**Scatter**    
An example of the Dist.io *scatter* pattern.

**Speedup**    
Some examples where distributed programming really *speeds things up*.

**Workpool**    
An example of the Dist.io *workpool* pattern.
