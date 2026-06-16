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
mimetypes.add_type('text/css', '.css', True)
mimetypes.add_type('image/svg+xml', '.svg', True)

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
        # --- CORS HEADERS ---
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Grist-API-Key')
        
        # --- AGGRESSIVE CACHE BUSTING FOR EVERYTHING ---
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        
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

    def do_DELETE(self):
        if self.path.startswith('/grist-proxy/'):
            self._handle_proxy('DELETE')
        else:
            self.send_error(404)

    def _handle_proxy(self, method):
        # Reload environment sparingly or only if needed
        # For now, keeping it but it's risky in multi-threaded if multiple writes happen
        # load_dotenv(override=True) 
        
        server = os.getenv("GRIST_SERVER", "").rstrip("/")
        api_key = os.getenv("GRIST_API_KEY", "")
        
        path = self.path.replace('/grist-proxy', '')
        url = f"{server}{path}"
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        try:
            self.log_message(f"PROXY {method}: {url}")
            response = requests.request(method, url, headers=headers, data=body, timeout=10)
            self.send_response(response.status_code)
            
            # Forward content-type if available
            remote_content_type = response.headers.get('Content-Type', 'application/json')
            self.send_header('Content-Type', remote_content_type)
            
            self.end_headers()
            self.wfile.write(response.content)
        except Exception as e:
            self.log_message("Erro no Proxy: %s", str(e))
            # Send error without blocking
            if not self.wfile.closed:
                try:
                    self.send_error(500, f"Proxy Error: {str(e)}")
                except: pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    if os.path.exists(LOG_FILE): os.remove(LOG_FILE)

    print(f"--- SERVIDOR MULTI-THREAD ATIVO (Porta {PORT}) ---")
    print(f"Suporta Grist Desktop e Servidores remotos simultaneamente.")
    
    with ThreadedTCPServer(("", PORT), GristProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrando servidor...")
            httpd.shutdown()
            sys.exit(0)
