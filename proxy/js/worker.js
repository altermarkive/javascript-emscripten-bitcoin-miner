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

function hexlify(text){
  var hex = "0123456789abcdef";
  var result = "";
  for(var i = 0; i < text.length; i++){
    var value = text.charCodeAt(i);
    result += hex[(value >> 4) & 0xF];
    result += hex[(value >> 0) & 0xF];
  }
  return result;
}

function increase_extranonce2(job){
  job.extranonce2++;
  return job.extranonce2;
}

function build_coinbase(job, extranonce){
  return job.coinb1 + extranonce + job.coinb2;
}

function build_merkle_root(job, coinbase_hash_hex){
  var merkle_root = coinbase_hash_hex;
  for(var i = 0; i < job.merkle_branch.length; i++){
    var h = job.merkle_branch[i];
    merkle_root = doublesha(merkle_root + h);
  }
  return merkle_root;
}

function serialize_header(job, merkle_root, ntime, nonce){
  var r = job.version;
  r += job.prevhash;
  r += merkle_root;
  r += pack(ntime);
  r += job.nbits;
  r += pack(nonce);
  r += "000000800000000000000000000000000000000000000000000000000000000000000000000000000000000080020000"; // padding
  return r;
}

function pad(hexadecimal, bits){
  var zeros = (bits / 4) - hexadecimal.length;
  for(var i = 0; i < zeros; i++){
    hexadecimal = "0" + hexadecimal;
  }
  return hexadecimal;
}

function pack(value){
  value = value.toString(16);
  return pad(value, 32);
}

function extranonce2_padding(job, extranonce2){
  var extranonce2_hex = extranonce2.toString(16);
  var missing_len = job.extranonce2_size * 2 - extranonce2_hex.length;

  if(missing_len < 0){
    console.error("Extranonce size mismatch. Please report to pool operator.");
    return extranonce2_hex.substring(Math.abs(missing_len));
  }

  return pad(extranonce2_hex, job.extranonce2_size * 8);
}

function build_full_extranonce(job, extranonce2){
  return job.extranonce1 + extranonce2_padding(job, extranonce2);
}

function reverse(hexadecimal){
  var reversed = "";
  for(var i = 0; i < hexadecimal.length; i += 2){
    reversed = hexadecimal.substring(i, i + 2) + reversed;
  }
  return reversed;
}

function reverse_hash(h){
  var length = h.length / 8;
  var reversed = "";
  for(var i = 0; i < length; i++){
    reversed += reverse(h.substring(i * 8, i * 8 + 8));
  }
  return reversed;
}

function doublesha(hexed){
  var buffer = Module._malloc(65);
  sha256(hexed, buffer);
  hexed = hexlify(Pointer_stringify(buffer));
  sha256(hexed, buffer);
  var result = Pointer_stringify(buffer);
  Module._free(buffer);
  return result;
}

function getwork(last_job){
  // Miner requests for new getwork

  var job = last_job; // Pick the latest job from pool

  // 1. Increase extranonce2
  var extranonce2 = increase_extranonce2(job);

  // 2. Build final extranonce
  var extranonce = build_full_extranonce(job, extranonce2);

  // 3. Put coinbase transaction together
  var coinbase = build_coinbase(job, extranonce);

  // 4. Calculate coinbase hash
  var coinbase_hash_hex = doublesha(coinbase);

  // 5. Calculate merkle root
  var merkle_root = reverse_hash(build_merkle_root(job, coinbase_hash_hex));

  // 6. Generate current ntime
  var ntime = Math.round(Date.now() / 1000) + job.ntime_delta;

  // 7. Serialize header
  var block_header = serialize_header(job, merkle_root, ntime, 0);

  // 8. Register job params
  var result = {};
  result.job = job;
  result.merkle_root = merkle_root;
  result.extranonce2 = extranonce2;

  // 9. Prepare hash1, calculate midstate and fill the response object
  var hash1 = "00000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000010000"
  result.data = block_header;
  result.hash1 = hash1;
  result.target = job.target;

  return result;
}

function submit(work, header){
  var result = {};

  // Drop unused padding
  header = header.substring(0, 160);

  // 1. Check if blockheader meets requested difficulty
  var rev = reverse_hash(header);
  var hash_hex = doublesha(rev);

  var below = false;
  for(var i = 0; i < 32; i++){
    // Target is big-endian, header little-endian
    var start = 64 - i * 2 - 2;
    var stop = 64 - i * 2;
    var target = parseInt(work.job.target.substring(start, stop), 16);
    var value = parseInt(hash_hex.substring(start, stop), 16);
    if(value > target){
      below = true;
      break;
    }
    if(value < target){
      break;
    }
  }
  if(below){
    console.debug("Share is below expected target");
    postMessage("");
    return;
  }

  // 2. Lookup for job and extranonce used for creating given block header
  // 3. Format extranonce2 to hex string
  var extranonce2_hex = extranonce2_padding(work.job, work.extranonce2);

  // 4. Parse ntime and nonce from header
  var ntimepos = 17 * 8; // 17th integer in datastring
  var noncepos = 19 * 8; // 19th integer in datastring
  var ntime = header.substring(ntimepos, ntimepos + 8);
  var nonce = header.substring(noncepos, noncepos + 8);

  // 5. Submit share to the pool
  result.job_id = work.job.job_id;
  result.extranonce2_hex = extranonce2_hex;
  result.ntime = ntime;
  result.nonce = nonce;

  postMessage(JSON.stringify(result));
}

var accepted = null;
var iterated = null;
var work = null;
var step = 100000;
var start = 0;
var stop = 0;
var aggressive = true;

// Receives the configuration of the pool wrom the main "thread"
onmessage = function (event){
  var job = JSON.parse(event.data);
  if(accepted == null){
    console.log("Got first job");
    accepted = job;
  }else{
    // TODO: The second part of the condition may cause job to be recalculated
    if(job.job_id != accepted.job_id || job.target != accepted.target){
      if(aggressive || job.clean_jobs){
        console.log("Accepted new job");
        accepted = job;
      }
    }
  }
  // Run a chunk of work
  go();
}

// Import the Emscripten compiled mining/hashing code
importScripts("/js/miner.js");

// Bind the functions compiled from C
var mine = Module.cwrap("mine", "number", ["string", "string", "string", "number", "number", "number"]);
var sha256 = Module.cwrap("sha256", null, ["string", "number"]);

function go(){
  // Switch to new job if there is one (remember to go idle in between)
  if(iterated != accepted){
    console.log("Starting new job");
    work = null;
    iterated = accepted;
  }
  // Pull more work if idle
  if(work == null){
    console.log("Pulling more work");
    work = getwork(iterated);
    start = 0;
    stop = start + step;
  }
  // Work
  var buffer = Module._malloc(257);
  var before = Date.now();
  var last = mine(work.hash1, work.data, work.target, start, stop, buffer);
  var after = Date.now();
  var proof = Pointer_stringify(buffer);
  var found = proof.length != 0;
  Module._free(buffer);
  // Recalculate the step
  console.log("(" + start + "," + stop + "," + last + "," + step + ")");
  var speed = (last - start + 1.0) / (after - before);
  console.log("Speed [khash/s]: " + speed);
  step = Math.round(speed * 10000); // 10 seconds
  step = step < 100000 ? 100000 : step;
  // Recalculate the start & stop nonces
  start = last + 1;
  if(0xFFFFFFFF - start < step){
    stop = 0xFFFFFFFF;
  }else{
    stop = start + step;
  }
  // Inspect
  if(found){
    console.log("Found proof-of-work");
    submit(work, proof);
    work = null;
  }else{
    if(last == 0xFFFFFFFF){
      work = null;
    }
    postMessage("");
  }
}
