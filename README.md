JavaScript-Emscripten-Bitcoin-Miner
===================================

This project implements a working JavaScript Emscripten Bitcoin Miner. The purpose of the code is nothing more than a proof-of-concept.
Why? It makes perfect sense to me that some websites need ways to fund their operation.
However, the idea that they use the resources of my computer (for mining Bitcoins) instead of my own eyes and mind (for processing advertisements) appeals to me a lot.

The core mining (hashing) is implemented in C:

[native/miner.c](native/miner.c)

This code is compiled with Emscripten to JavaScript (with asm.js output enabled):

[native/Makefile](native/Makefile)

Here's the resulting code:

[proxy/js/miner.js](proxy/js/miner.js)

The communication with a mining pool is implemented by hand in JavaScript:

[proxy/js/worker.js](proxy/js/worker.js)

The miner is using Web Workers to run the processing (it does not detect number of CPU cores
to optimize the use of resources though). Running on Intel(R) Core(TM) i7-3720QM at 2.6GHz it reaches:
* in Chrome 37 the miner reaches ~32 khash/s
* in Firefox 32 the miner reaches ~220 khash/s

Both parts (compiled hashing code & communication with a mining pool) are rolled together into code ready to be embedded in an HTML document:

[proxy/html/test.html](proxy/html/test.html)

[proxy/js/manager.js](proxy/js/manager.js)

The script accepts following parameters: "host" and "port" number of the pool along with the "user" (worker name) and the "password" (worker password).

JavaScript embedded in an HTML cannot connect to an arbitrary host.
Therefore, if you do not have your own mining pool on the same host you will have to use a proxy.
This project includes also a proxy which is implemented in Python and meant to run on Google AppEngine.

[proxy/Docker](proxy/Docker)

[proxy/bitcoin-mining-pool-proxy.py](proxy/bitcoin-mining-pool-proxy.py)

Enjoy!
