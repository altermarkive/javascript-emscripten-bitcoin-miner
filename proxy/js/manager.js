/*

JavaScript Emscripten Bitcoin Miner

This code creates a Web Worker "thread" and passes along the configuration.

The MIT License (MIT)

Copyright (c) 2016

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

var id = 3;

function next(){
  return(id++);
}

function urlParseHost(url){
  var re = new RegExp("^(?:f|ht)tp(?:s)?\://([^/]+)", "im");
  return(url.match(re)[1].toString());
}

function urlParseQuery(url){
  var re = new RegExp("[?&]+([^=&]+)=([^&]*)", "gi");
  var map = {};
  var parts = url.replace(re, function(ignore, key, value){map[key] = decodeURIComponent(value);});
  return(map);
}

var ws = null;
var worker = null;

var scrypt_target = false;

var extranonce1 = null;
var extranonce2_size = null;
var target = null;

function rpc(message){
  message = JSON.stringify(message);
  console.log("Put: " + message);
  ws.send(message + "\n");
}

function stratum(event){
  console.log("Got: " + event.data);
  if(event.data instanceof Blob){
    console.warn("Ignoring a binary blob");
    return;
  }
  var message = JSON.parse(event.data);
  if(message.error != null){
    console.error(message.error);
    ws.close();
    return;
  }
  switch(message.id){
    case 0:
      extranonce1 = message.result[1];
      extranonce2_size = message.result[2];
      console.log("Subscribed (" + extranonce1 + "," + extranonce2_size + ")");
      var credentials = [configuration.user, configuration.password];
      var message = {method:"mining.authorize", params:credentials, id:1};
      rpc(message);
      break;
    case 1:
      if(message.result){
        console.log("Authorized");
      }else{
        setTimeout(function (){ws.close();}, 60000);
      }
      break;
    case null:
      handle(message);
      break;
    default:
      console.log("The proof is " + message.result);
  }
}

function build_from_broadcast(message){
  var job = {};
  job.job_id = message.params[0];
  job.prevhash = message.params[1];
  job.coinb1 = message.params[2];
  job.coinb2 = message.params[3];
  job.merkle_branch = message.params[4];
  job.version = message.params[5];
  job.nbits = message.params[6];
  job.ntime = message.params[7];
  job.ntime_delta = parseInt(job.ntime, 16) - Math.round(Date.now() / 1000);
  job.clean_jobs = message.params[8];
  job.extranonce2 = 0;
  return job;
}

function reverse(hexadecimal){
  var reversed = "";
  for(var i = 0; i < hexadecimal.length; i += 2){
    reversed = hexadecimal.substring(i, i + 2) + reversed;
  }
  return reversed;
}

function pad(hexadecimal, bits){
  var zeros = (bits / 4) - hexadecimal.length;
  for(var i = 0; i < zeros; i++){
    hexadecimal = "0" + hexadecimal;
  }
  return hexadecimal;
}

function set_difficulty(difficulty){
  difficulty = bigInt(difficulty);
  if(scrypt_target){
    dif1 = bigInt("0000ffff00000000000000000000000000000000000000000000000000000000", 16);
  }else{
    dif1 = bigInt("00000000ffff0000000000000000000000000000000000000000000000000000", 16);
  }
  var aim = dif1.divide(difficulty);
  target = reverse(pad(aim.toString(16), 256));
}

set_difficulty(1);

var job = null;

function handle(message){
  switch(message.method){
    case "mining.notify":
      // Extract the job parameters
      var vacancy = build_from_broadcast(message);
      // Append the global values
      vacancy.extranonce1 = extranonce1;
      vacancy.extranonce2_size = extranonce2_size;
      vacancy.target = target;
      // Post job template to the worker
      if(job == null){
        worker.postMessage(JSON.stringify(vacancy));
      }
      // Remember current vacancy
      job = vacancy;
      break;
    case "mining.set_difficulty":
      set_difficulty(message.params[0]);
      break;
    case "client.reconnect":
      if(message.params[0] != null){
        configuration.host = message.params[0];
      }
      if(message.params[1] != null){
        configuration.port = message.params[1];
      }
      var wait = message.params[2];
      console.log("Server requested to reconnect");
      ws.close();
      break;
    case "client.show_message":
      console.log("Server message: " + message.params[0]);
      break;
    default:
      console.warn("I can't handle it: " + message.method);
  }
}

function opened(event){
  console.log("WS Opened");
  console.log(event);
  var message = {method:"mining.subscribe", params:[], id:0};
  rpc(message);
}

function failed(event){
  extranonce1 = null;
  extranonce2_size = null;
  ws.close();
  console.log("WS Error");
  console.error(event);
  setTimeout(connect, 30000);
}

function closed(event){
  extranonce1 = null;
  extranonce2_size = null;
  ws.close();
  console.log("WS Closed");
  console.log(event);
  setTimeout(connect, 1000);
}

function connect(){
  var origin = urlParseHost(location.origin);
  ws = new WebSocket("ws://" + origin + ":8080/?host=" + configuration.host + "&port=" + configuration.port);
  ws.onmessage = stratum;
  ws.onopen = opened;
  ws.onerror = failed;
  ws.onclose = closed;
}

function callback(event){
  if(event.data.length != 0){
    console.log("Called back with: " + event.data);
    var result = JSON.parse(event.data);
    var parameters = [configuration.user, result.job_id, result.extranonce2_hex, result.ntime, result.nonce];
    var message = {method:"mining.submit", params:parameters, id:next()};
    rpc(message);
  }
  worker.postMessage(JSON.stringify(job));
}

// Checks if Web Workers API is supported
function works(){
  return(typeof window.Worker === "function");
}

// Creates a Web Worker "thread" if possible and pass along the configuration
function work(configuration){
  if(works()){
    this.configuration = configuration;
    worker = new Worker("/js/worker.js");
    worker.onmessage = callback;
    connect();
  }else{
    console.log("Idle (Web Workers API is not supported)");
  }
}
