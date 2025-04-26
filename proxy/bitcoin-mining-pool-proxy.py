#!/usr/bin/env python
#
# JavaScript Emscripten Bitcoin Miner
#
# This is the Bitcoin mining pool proxy service.
# JavaScript code cannot connect to anything except for the originating host
# so to use any existing mining pool it was necessary to do it via a proxy service.
#
# When an HTTP GET request is made it will redirect to an example HTML file
# which demonstrates the use of the Flash Player Bitcoin Miner.
#
# The HTTP POST requests are simply channeled between the JavaScript code
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

from google.appengine.api             import urlfetch
import webapp2

class Proxy(webapp2.RequestHandler):
    def post(self):
        host = self.request.get('host', '')
        port = self.request.get('port', '')
        id = self.request.get('id', '')
        response = urlfetch.fetch(
            url='http://%s:%s' % (host, port),
            payload=self.request.body,
            method=urlfetch.POST,
            deadline=3,
            headers={'Authorization': 'Basic ' + id})
        self.response.set_status(response.status_code)
        self.response.out.write(response.content)

class Main(webapp2.RequestHandler):
    def get(self):
        self.redirect('/html/test.html')

app = webapp2.WSGIApplication([('/', Main), ('/proxy', Proxy)], debug=False)
