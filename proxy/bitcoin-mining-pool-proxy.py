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
# This code is free software: you can redistribute it and/or modify it under
# the terms of the GNU Lesser General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# This code is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for
# more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with code. If not, see <http://www.gnu.org/licenses/>.

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
