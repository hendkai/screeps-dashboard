#!/usr/bin/env python3
"""
Screeps API Proxy Server
Löst CORS-Probleme durch Weiterleitung der API-Anfragen mit korrekten Headers
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
from urllib.error import HTTPError, URLError

class CORSProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Token, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.proxy_api_request()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.proxy_api_request()
        else:
            self.send_error(405, "Method not allowed")
    
    def proxy_api_request(self):
        # Remove /api/ prefix and create Screeps API URL
        api_path = self.path[5:]  # Remove '/api/'
        screeps_url = 'https://screeps.com/api/' + api_path
        
        try:
            # Get headers from original request
            headers = {}
            for header_name, header_value in self.headers.items():
                if header_name.lower() not in ['host', 'connection']:
                    headers[header_name] = header_value
            
            # Create request
            if self.command == 'GET':
                req = urllib.request.Request(screeps_url, headers=headers)
            elif self.command == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length) if content_length > 0 else None
                req = urllib.request.Request(screeps_url, data=post_data, headers=headers)
            
            # Make request to Screeps API
            with urllib.request.urlopen(req) as response:
                # Send response back to client
                self.send_response(response.getcode())
                
                # Copy headers (except problematic ones)
                for header_name, header_value in response.headers.items():
                    if header_name.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(header_name, header_value)
                
                self.end_headers()
                
                # Copy response body
                self.wfile.write(response.read())
                
        except HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({
                'error': f'API Error: {e.code} {e.reason}'
            }).encode('utf-8')
            self.wfile.write(error_response)
            
        except URLError as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({
                'error': f'Connection Error: {str(e.reason)}'
            }).encode('utf-8')
            self.wfile.write(error_response)
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({
                'error': f'Server Error: {str(e)}'
            }).encode('utf-8')
            self.wfile.write(error_response)

def main():
    PORT = 8081
    
    print(f"🚀 Screeps Dashboard Proxy Server")
    print(f"📡 Proxy läuft auf: http://localhost:{PORT}")
    print(f"🌐 Dashboard URL: http://localhost:{PORT}")
    print(f"🔧 API Proxy: http://localhost:{PORT}/api/")
    print(f"")
    print(f"✅ Das Dashboard wird jetzt OHNE CORS-Fehler funktionieren!")
    print(f"🛑 Drücke Ctrl+C zum Beenden")
    print(f"" + "="*50)
    
    with socketserver.TCPServer(("", PORT), CORSProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 Server gestoppt")

if __name__ == "__main__":
    main() 