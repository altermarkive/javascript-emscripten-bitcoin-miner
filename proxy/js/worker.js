/*

JavaScript Emscripten Bitcoin Miner

This code manages the communication between the mining pool and hashing code.

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

// Receives the configuration of the pool wrom the main "thread"
this.onmessage = function (event){
  go(JSON.parse(event.data));
};

// Import the Emscripten compiled mining/hashing code
importScripts("/js/miner.js");

// Bind the functions compiled from C
var mine = Module.cwrap("mine", "number", ["string", "string", "string", "number", "number", "number"]);

// Handles the HTTP POST calls to the mining pool
function httpPost(url, data){
  http = new XMLHttpRequest();
  http.open("POST", url, false);
  http.send(data);
  return({status: http.status, text:http.responseText});
}

// A pretend "sleep" function
function sleep(timeout){
  var then = new Date().getTime();
  do{
    var now = new Date().getTime();
  }while(now - then < timeout);
}

// An empty-handed request for new work
var nothing = {method:"getwork", id:0, params:[]};

function go(configuration){
  // Construct the mining pool URL
  var pool = "/proxy?host=" + configuration.host + "&port=" + configuration.port + "&id=" + btoa(configuration.user + ":" + configuration.password);
  // Number of nonces to check before requesting new work
  var limit = 100000;
  // Have we found a proof of work?
  var found = false;
  var proof = "";
  // Main loop running work requests and working
  while(true){
    var request;
    // Include proof-of-work if found
    if(found){
      request = {method:"getwork", id:0, params:[proof]};
    }else{
      request = nothing;
    }
    // Send the JSON request with an HTTP POST
    var work = httpPost(pool, JSON.stringify(request));
    if(200 == work.status){
      var response = JSON.parse(work.text);
      if(null == response["error"]){
        if(true == response["result"] || false == response["result"]){
          // This is a response to a submitted proof-of-work
          // Check if it is a true or false one and request a new job
          if(response["result"]){
            console.log("True proof-of-work");
          }else{
            console.log("False proof-of-work");
          }
          found = false;
          continue;
        }else{
          // This is a response to a request for a new job, get to it
          var hash1    = response["result"]["hash1"];
          var data     = response["result"]["data"];
          var target   = response["result"]["target"];
          // Run the hashing loop
          var buffer = Module._malloc(257);
          var before = new Date().getTime();
          var nonce = mine(hash1, data, target, 0, limit, buffer);
          var after = new Date().getTime();
          proof = Pointer_stringify(buffer);
          found = proof.length == 0;
          Module._free(buffer);
          // Calculate hashing speed in [khash/s]
          limit = (nonce + 1.0) / (after - before);
          console.log("Speed [khash/s]: " + limit);
          // Set the number of nonces to check to work maximum 3 [s]
          limit = Math.round(limit * 5000);
          // Make sure that we have some bare minimum of work done
          if(limit < 100000){
            limit = 100000;
          }
        }
      }else{
        // The mining pool server replied with an error
        console.log("Error: " + response["error"]);
        sleep(15000)
      }
    }else{
      // The mining pool server failed to reply
      console.log("Error: " + work.status);
      sleep(15000)
    }
  }
}
