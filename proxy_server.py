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
mimetypes.init()
mimetypes.add_type('application/javascript', '.js', True)
mimetypes.add_type('application/javascript', '.mjs', True)

load_dotenv()

PORT = 3000
GRIST_SERVER = os.getenv("GRIST_SERVER", "").rstrip("/")
GRIST_API_KEY = os.getenv("GRIST_API_KEY", "")
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proxy_debug.txt")
print(f"Log file path: {LOG_FILE}")

class GristProxyHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Registra no arquivo para o Gemini ler
        log_entry = f"[{self.log_date_time_string()}] {format%args}\n"
        with open(LOG_FILE, "a") as f:
            f.write(log_entry)
        # Também imprime no terminal
        sys.stderr.write(log_entry)

    def end_headers(self):
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        
        # --- DESATIVAR CACHE PARA DESENVOLVIMENTO ---
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/grist-proxy/'):
            self._handle_proxy('GET')
        else:
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
        # Reload environment on every request to pick up .env changes without restart
        load_dotenv(override=True)
        server = os.getenv("GRIST_SERVER", "").rstrip("/")
        api_key = os.getenv("GRIST_API_KEY", "")
        
        path = self.path.replace('/grist-proxy', '')
        url = f"{server}{path}"
        masked_key = (api_key[:5] + "..." + api_key[-5:]) if api_key else "MISSING"
        self.log_message(f"RELOADED PROXY: {method} to: {url} | Server: {server} | Key: {masked_key}")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        try:
            response = requests.request(method, url, headers=headers, data=body)
            self.send_response(response.status_code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(response.content)
        except Exception as e:
            self.log_message("Erro no Proxy: %s", str(e))
            self.send_error(500, f"Proxy Error: {str(e)}")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

class MyTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if os.path.exists(LOG_FILE): os.remove(LOG_FILE) # Limpa log ao iniciar

print(f"--- SERVIDOR PROXY COM LOG ATIVO (Porta {PORT}) ---")
try:
    with MyTCPServer(("", PORT), GristProxyHandler) as httpd:
        httpd.serve_forever()
except Exception as e:
    print(f"Erro ao iniciar: {e}")
