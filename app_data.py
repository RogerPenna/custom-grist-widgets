import requests
import os
import json
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

# Caminhos de configuração
LOGO_PATH = "app_config/custom_logo.txt"
MENU_PATH = "app_config/menu.json"

class GristClient:
    def __init__(self):
        self.server = os.getenv("GRIST_SERVER", "http://localhost:8484").rstrip("/")
        self.api_key = os.getenv("GRIST_API_KEY", "")
        self.doc_id = os.getenv("GRIST_DOC_ID", "")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def get_tables(self):
        """Lista todas as tabelas disponíveis no documento."""
        url = f"{self.server}/api/docs/{self.doc_id}/tables"
        try:
            res = requests.get(url, headers=self.headers)
            return res.json().get("tables", []) if res.status_code == 200 else []
        except: return []

    def get_records(self, table_id):
        """Busca registros e simplifica o formato para o frontend."""
        url = f"{self.server}/api/docs/{self.doc_id}/tables/{table_id}/records"
        try:
            res = requests.get(url, headers=self.headers)
            if res.status_code == 200:
                # Transforma [{id: 1, fields: {A: 1}}] em [{id: 1, A: 1}]
                data = res.json().get("records", [])
                return [{**r["fields"], "id": r["id"]} for r in data]
            return []
        except: return []

    def get_config(self, config_id):
        """Busca e unifica a tripartição (Mapping, Styling, Actions) de uma configuração."""
        if not config_id: return None
        
        configs = self.get_records("Grf_config")
        conf = next((r for r in configs if r.get("configId") == config_id), None)
        
        if not conf: return None

        # Monta o JSON unificado para o Visualizador Universal
        merged = {
            "configId": config_id,
            "componentType": conf.get("componentType", "CardSystem"),
            "tableId": conf.get("tableID") or conf.get("tableId"), # Suporte a nomes antigos
            "mapping": {},
            "styling": {},
            "actions": {}
        }

        # Faz o parse seguro de cada bloco da tripartição
        for part in ["mappingJson", "stylingJson", "actionsJson"]:
            key = part.replace("Json", "")
            if conf.get(part):
                try: merged[key] = json.loads(conf[part])
                except: merged[key] = {}

        return merged

def load_menu():
    """Carrega a estrutura do menu lateral."""
    if os.path.exists(MENU_PATH):
        try:
            with open(MENU_PATH, "r", encoding="utf-8") as f: return json.load(f)
        except: pass
    return [{"category": "Administração", "items": [{"label": "Explorador", "icon": "", "configId": ""}]}]

def save_menu(menu):
    """Salva a estrutura do menu lateral."""
    os.makedirs(os.path.dirname(MENU_PATH), exist_ok=True)
    with open(MENU_PATH, "w", encoding="utf-8") as f:
        json.dump(menu, f, indent=4, ensure_ascii=False)

def strip_accents(s):
    """Remove acentos para chaves internas do Streamlit."""
    import unicodedata
    return "".join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
