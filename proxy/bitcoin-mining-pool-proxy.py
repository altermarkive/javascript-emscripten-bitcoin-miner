#!/usr/bin/env python
#
# JavaScript Emscripten Bitcoin Miner
#
# This is the Bitcoin mining pool proxy service.
# JavaScript code cannot connect to anything except for the originating host
# so to use any existing mining pool it was necessary to do it via a proxy service.
#
# When an HTTP GET request is made it will redirect to an example HTML file
# which demonstrates the use of the JavaScript Bitcoin Miner.
#
# The WebSocket requests are simply channeled between the JavaScript code
# and the mining pool configured in the HTML file.
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

import autobahn.twisted.websocket
import json
import os
import socket
import sys
import twisted.internet.defer
import twisted.internet.protocol
import twisted.internet.reactor
import twisted.web.resource
import twisted.web.server
import twisted.web.static

from twisted.python import log

class Root(twisted.web.static.File):
    def directoryListing(self):
        return twisted.web.resource.ForbiddenResource()

class ProxyClient(twisted.internet.protocol.Protocol):
    def connectionMade(self):
        log.msg('Server connected')
        self.factory.to_server.get().addCallback(self.dataEnqueued)
        try:
            self.transport.getHandle().setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
            self.transport.getHandle().setsockopt(socket.SOL_TCP, socket.TCP_KEEPIDLE, 60)
            self.transport.getHandle().setsockopt(socket.SOL_TCP, socket.TCP_KEEPINTVL, 1)
            self.transport.getHandle().setsockopt(socket.SOL_TCP, socket.TCP_KEEPCNT, 5)
        except:
            pass

    def dataEnqueued(self, data):
        if data is None:
            log.msg('Client disconnecting from server')
            self.transport.loseConnection()
        else:
            log.msg('Queue -> Server: %s' % str(data))
            self.transport.write(data)
            self.factory.to_server.get().addCallback(self.dataEnqueued)

    def dataReceived(self, data):
        log.msg('Server -> Queue: %s' % str(data))
        self.factory.to_client.put(data)

    def connectionLost(self, why):
        log.msg('Server disconnected (%s)' % str(why))
        self.factory.to_client.put(None)

class ProxyClientFactory(twisted.internet.protocol.ClientFactory):
    protocol = ProxyClient

    def __init__(self, to_client, to_server):
        self.to_client = to_client
        self.to_server = to_server

class ProxyServer(autobahn.twisted.websocket.WebSocketServerProtocol):
    def onConnect(self, request):
        log.msg('Client connected (%s)' % str(request))
        self.targetTCPHost = request.params['host'][0]
        self.targetTCPPort = int(request.params['port'][0])

    def onOpen(self):
        log.msg('WebSocket is open')
        self.to_client = twisted.internet.defer.DeferredQueue()
        self.to_server = twisted.internet.defer.DeferredQueue()
        self.to_client.get().addCallback(self.onQueue)

        factory = ProxyClientFactory(self.to_client, self.to_server)
        twisted.internet.reactor.connectTCP(self.targetTCPHost, self.targetTCPPort, factory)

    def onQueue(self, data):
        if data is None:
            log.msg('Server disconnecting from client')
            self.sendClose()
        else:
            log.msg('Queue -> Client: %s' % str(data))
            try:
                json.loads(data)
                isBinary = False
            except:
                isBinary = True
            self.sendMessage(data, isBinary)
            self.to_client.get().addCallback(self.onQueue)

    def onMessage(self, data, isBinary):
        log.msg('Client -> Queue (%s): %s' % ('binary' if isBinary else 'text', str(data)))
        self.to_server.put(data)

    def onClose(self, wasClean, code, reason):
        log.msg('Client disconnected (%s, %s, %s)' % (str(wasClean), str(code), str(reason)))
        self.to_server.put(None)

if __name__ == "__main__":
    log.startLogging(sys.stdout)
    root = Root('/var/service')
    site = twisted.web.server.Site(root)
    ws = autobahn.twisted.websocket.WebSocketServerFactory('ws://127.0.0.1:8080')
    ws.protocol = ProxyServer
    twisted.internet.reactor.listenTCP(80, site)
    twisted.internet.reactor.listenTCP(8080, ws)
    twisted.internet.reactor.run()
