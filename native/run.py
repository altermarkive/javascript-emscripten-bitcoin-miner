#!/usr/bin/python
# JavaScript Emscripten Bitcoin Miner
#
# This script runs the native standalone miner (this is for testing purposes).
# It takes three input parameters:
# 1. URL of the mining pool server (including port number)
# 2. Worker name
# 3. Worker password
#
# The MIT License (MIT)
#
# Copyright (c) 2016
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import base64
import json
import os
import random
import time
import signal
import sys
import threading
import urllib2

# Thread handling long poll feature
class Watchdog(threading.Thread):
    def run(self):
        while True:
            if poll == None:
                # Long poll not available
                time.sleep(1)
            else:
                try:
                    # Open up connection to the long poll URL and wait
                    pool(poll, None, 1 * 60 * 60)
                    # Long poll responded (which means invalidation of current job)
                    print 'Long-poll: Interrupt'
                    sys.stdout.flush()
                    # Kill the native miner process
                    os.system('bash killer.sh')
                except Exception, exception:
                    print exception
                    sys.stdout.flush()

# Requests a job from the mining pool (or submits a proof-of-work)
def pool(url, proof, timeout):
    global poll
    global scantime
    # Format JSON request
    parameters = []
    if proof != None and proof != '':
        # Include proof-of-work
        parameters.append(proof)
    request = urllib2.Request(url)
    # Format HTTP request with the JSON data and authorization token
    request.add_data(json.dumps({'method': 'getwork', 'params': parameters, 'id': 0}))
    request.add_header('Content-Type', 'application/json')
    request.add_header('Authorization', authorization)
    # Issue an HTTP GET request until successful
    while True:
        try:
            if timeout != None:
                response = urllib2.urlopen(request, timeout=timeout)
            else:
                response = urllib2.urlopen(request)
            break
        except:
            time.sleep(30)
    # If server indicates support for long poll feature then construct its URL
    if response.headers.has_key('X-Long-Polling'):
        extension = response.headers['X-Long-Polling']
        if extension.find('http://') == -1 and extension.find('https://') == -1:
            poll = url + extension
        else:
            poll = extension
        scantime = 60
    else:
        poll = None
    # Return the JSON response
    return json.loads(response.read())

# Check if the parameters were passed
if len(sys.argv) < 4:
    print 'Usage: run.py [POOL URL] [WORKER NAME] [WORKER PASSWORD]'
    print 'In some cases you might need to put double quotes around worker name or password.'
    quit()
# Initialize pool URL
url = sys.argv[1]
# Initialize long-polling URL variable
poll = None
# Initialize authorization token
authorization = 'Basic %s' % base64.b64encode('%s:%s' % (sys.argv[2], sys.argv[3]))
# Initialize maximum nonce value
maximum = 0xFFFFFF
# Initialize scan-time value
scantime = 5
# Initialize proof-of-work
proof = None

# Start the thread handling the long poll feature
watchdog = Watchdog()
watchdog.start()

# Mine!
while True:
    # Request a job
    work = pool(url, None, None)
    # Remember the time when mining started
    before = time.time()
    # Start the native miner process
    process = os.popen('./miner %s %s %s %s %u' % (work['result']['hash1'], work['result']['data'], work['result']['target'], maximum))
    # Read the response of the native miner process (it contains number of hashes processed and potentialy proof-of-work)
    output = process.read()
    # Remember the time when mining stopped
    after = time.time()
    # Extract the number of hashes processed and proof-of-concept from the response
    (proof, nonces) = output.split(',')
    nonces = int(nonces)
    # Adjust the nonce limit depending on planned scantime and hashing rate
    candidate = (nonces * scantime) / (after - before)
    if candidate > 0xFFFFFFFA:
        candidate = 0xFFFFFFFA
    maximum = int(candidate)
    # Print diagnostic message with info about the performance
    print '%dkhash/s' % int((nonces / (after - before)) / 1000)
    # If the proof-of-work is present then submit it
    if proof != '':
        confirmation = pool(url, proof, None)
        # Check if it was a true or false proof-of-work
        if confirmation['result']:
            print 'Proof-of-work: True'
        else:
            print 'Proof-of-work: False'
    sys.stdout.flush()
