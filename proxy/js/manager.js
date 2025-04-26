/*

JavaScript Emscripten Bitcoin Miner

This code creates a Web Worker "thread" and passes along the configuration.

This code is free software: you can redistribute it and/or modify it under
the terms of the GNU Lesser General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option)
any later version.

This code is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for
more details.

You should have received a copy of the GNU Lesser General Public License
along with code. If not, see <http://www.gnu.org/licenses/>.

*/

// Checks if Web Workers API is supported
function works() {
  return(typeof window.Worker === "function");
}

// Creates a Web Worker "thread" if possible and pass along the configuration
function work(configuration){
  if(works()){
    var worker = new Worker("/js/worker.js");
    worker.postMessage(JSON.stringify(configuration));
  }else{
    console.log("Idle (Web Workers API is not supported)");
  }
}