import http.server
import socketserver
import requests
import os
import sys
import json
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

# Forçar cabeçalho JS no Windows
import mimetypes
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')

load_dotenv()

PORT = 3000
GRIST_SERVER = os.getenv("GRIST_SERVER", "").rstrip("/")
GRIST_API_KEY = os.getenv("GRIST_API_KEY", "")

class GristProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/grist-proxy/'):
            self._handle_proxy('GET')
        else:
            # Servir arquivos da raiz (onde estão libraries/ e configurator.html)
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/grist-proxy/'):
            self._handle_proxy('POST')
        else:
            self.send_error(404)

    def do_PATCH(self):
        if self.path.startswith('/grist-proxy/'):
            self._handle_proxy('PATCH')
        else:
            self.send_error(404)

    def _handle_proxy(self, method):
        path = self.path.replace('/grist-proxy', '')
        url = f"{GRIST_SERVER}{path}"
        
        headers = {
            "Authorization": f"Bearer {GRIST_API_KEY}",
            "Content-Type": "application/json"
        }

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        try:
            response = requests.request(method, url, headers=headers, data=body)
            self.send_response(response.status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.content)
        except Exception as e:
            self.send_error(500, f"Proxy Error: {str(e)}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

# Permitir reuso do endereço (evita erro de porta ocupada em restarts rápidos)
class MyTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

print(f"Servidor Ponte PQC ativo em http://localhost:{PORT}")
try:
    with MyTCPServer(("", PORT), GristProxyHandler) as httpd:
        httpd.serve_forever()
except Exception as e:
    print(f"Falha ao iniciar servidor: {e}")
    sys.exit(1)
