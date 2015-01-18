var useCollection = true;
var createFailures = true;
var taskDuration = 0;
var beReactive = true;
var numberOfSubTasks = 50;
var debug = true;

// Set to 20 for a fixed number of sub queues
// set false or 0 to allow random 1..20 length
var fixedLength = 0;

if (Meteor.isClient) {
  queue = new PowerQueue({
    maxProcessing: 5,
    autostart: true,
    debug: debug,
    reactive: beReactive
  });

  var tasks = new Mongo.Collection('tasks', { connection: null});
  var taskIndex = 0;

  Template.tasks.helpers({
    tasks: function() {
      return tasks.find({});
    },
    $index: function(){
      //return (this.index % 20) == 0;
      return this.doBreak;
    }
  });

  queueErrorHandler = function(data, addTask) {
    // This error handler lets the task drop, but we could use addTask to
    // Put the task into the queue again
    if (useCollection) tasks.update({ _id: data.id }, { $set: { status: 'error'} });
  };

  queueTaskHandler = function(data, next) {

    // The task is now processed...
    if (useCollection) tasks.update({ _id: data.id }, { $set: { status: 'processing'} });

    Meteor.setTimeout(function() {
      if (createFailures && Math.random() > 0.5) {
        // We random fail the task
        if (useCollection) tasks.update({ _id: data.id }, { $set: { status: 'failed'} });
        // Returning error to next
        next(new Meteor.Error('Error: Fail task'));
      } else {
        // We are done!
        if (useCollection) tasks.update({ _id: data.id }, { $set: { status: 'done'} });
        // Trigger next task
        next();
      }
      // This async task duration is between 500 - 2000ms
    }, taskDuration || Math.round(500 + 1500 * Math.random()));
  };

  // reactiveObject = Reactive.extend({}, { 
  //   progress: Reactive.computation(function() {
  //     return Math.round((this.radius || 50) - 50);
  //   }),
  //   radius: Reactive.computation(function() {
  //     return Math.round((this.progress || 0) + 50);
  //   }),
  //   'class': 'blue' });

  Template.hello.helpers({
    processingList: function(){
      return queue.processingList();
    },
    masterQueue: function() {
      return {
        progress: queue.progress(),
        radius: 30,
        class: (queue.isPaused()) ? 'red' : 'green',
        length: queue.length(),
        total: queue.total(),
        maxProcessing: queue.maxProcessing(),
        processing: queue.processing(),
        failures: queue.failures(),
        errors: queue.errors(),
        autostart: queue.autostart(),
        running: queue.isRunning(),
        paused: queue.isPaused(),
        maxFailures: queue.maxFailures()
      };
    },
    processing: function() {
      return {
        progress: queue.usage(),
        radius: 30,
        class: (queue.processing())?'green':'blue'
      };
    },
    failureRate: function() {
      return {
        progress: Math.round(queue.failures() / queue.total() * 100),
        radius: 30,
        class: 'blue'
      };
    },
    errorRate: function() {
      return {
        progress: Math.round(queue.errors() / queue.total() * 100),
        radius: 30,
        class: 'red'
      };
    },
    reactive: function() {
      return reactiveObject;
    },
    greeting: function() {
      return "Welcome to power-queue.";
    }
  });

  var taskId = 0;
  var subQueueId = 0;

  var randomHexByte = function() {
    var value = Math.round(Math.random() * 255);
    return '' + value.toString(16);
  };

  var addSubTask = function() {
    subQueueId++;

    var newQueue = new PowerQueue({
      autostart: false,
      debug: debug,
      name: 'Queue' + subQueueId,
      reactive: beReactive
    });
    newQueue.taskHandler = queueTaskHandler;
    newQueue.errorHandler = queueErrorHandler;
    var numChunks = fixedLength || Math.round(Math.random() * 20 + 1);
    var border = '#'+randomHexByte()+randomHexByte()+randomHexByte();


    for (var a=0; a < numChunks; a++) {
      newQueue.add({
        id: (useCollection)? tasks.insert({ doBreak: (a == numChunks-1), status: 'added', index: ++taskId, border: border }):0
      });
    }
    newQueue.metadata = { name: 'Queue ' + subQueueId };

    queue.add(newQueue);
  };

  Meteor.startup(function() {
    for (var i=0; i < numberOfSubTasks; i++) {
      addSubTask();
    }
  });

  Template.hello.events({
    'click .addTask' : function () {
      for (var i=0; i < 10; i++) {
        addSubTask();
      }

    },
    'click .runQueue': function() {
      queue.run();
    },
    'click .btnReset': function() {
      queue.reset();
      if (useCollection) tasks.remove({});
    },
    'click .pauseQueue': function() {
      queue.pause();
    },
    'click .resumeQueue': function() {
      queue.resume();
    },
    'click .toggleAutostart': function() {
      queue.autostart(!queue.autostart());
    },
    'click .decLimit': function() {
      if (queue.maxProcessing() > 1) {
        queue.maxProcessing(queue.maxProcessing()-1);
      }
    },
    'click .incLimit': function() {
      queue.maxProcessing(queue.maxProcessing()+1);
    },
    'click .decLimit50': function() {
      if (queue.maxProcessing() > 6) {
        queue.maxProcessing(queue.maxProcessing()-5);
      } else {
        queue.maxProcessing(1);
      }
    },
    'click .incLimit100': function() {
      queue.maxProcessing(queue.maxProcessing()+10);
    },
    'click .decFailures': function() {
      if (queue.maxFailures() > 0) {
        queue.maxFailures(queue.maxFailures()-1);
      }
    },
    'click .incFailures': function() {
      queue.maxFailures(queue.maxFailures()+1);
    },
  });

  Template.progressCircle.events({
    'click': function(event, temp) {
      console.log(temp);
      temp.data.radius += 10;
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup

    var queue = new PowerQueue({
      isPaused: true
    });

    queue.add(function(done) {
      console.log('task 1');
      done();
      console.log('task 1 nr. 2...');
    });
    queue.add(function(done) {
      console.log('task 2');
      done();
    });
    queue.add(function(done) {
      console.log('task 3');
      done();
    });

    console.log('Ready to run queue');
    queue.run();
  });
}
