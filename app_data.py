# app_data.py - Data Provider para o Portal Pavicon PQC
import requests
import os
import json
import streamlit as st
from dotenv import load_dotenv
import unicodedata

load_dotenv()

LOGO_PATH = "app_config/custom_logo.txt"
MENU_PATH = "app_config/menu.json"

class GristClient:
    def __init__(self):
        self.server = os.getenv("GRIST_SERVER", "http://localhost:8484").rstrip("/")
        self.api_key = os.getenv("GRIST_API_KEY", "")
        self.doc_id = os.getenv("GRIST_DOC_ID", "qiVPiRA3ULcU")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def get_tables(self):
        """Lista todas as tabelas do documento."""
        url = f"{self.server}/api/docs/{self.doc_id}/tables"
        try:
            res = requests.get(url, headers=self.headers)
            if res.status_code == 200:
                return res.json().get("tables", [])
        except Exception as e:
            st.error(f"Erro ao conectar ao Grist: {e}")
        return []

    def get_records(self, table_id):
        """Busca registros de uma tabela e formata para o frontend."""
        url = f"{self.server}/api/docs/{self.doc_id}/tables/{table_id}/records"
        try:
            res = requests.get(url, headers=self.headers)
            if res.status_code == 200:
                data = res.json().get("records", [])
                return [{"id": r["id"], **r["fields"]} for r in data]
        except: pass
        return []

    def get_config(self, config_id):
        """Busca e unifica a tripartição (Mapping, Styling, Actions) do JSON do Grist."""
        configs = self.get_records("Grf_config")
        conf = next((r for r in configs if r.get("configId") == config_id), None)
        if not conf: return None
        
        # Estrutura base seguindo o padrão tripartido do framework
        merged = {
            "configId": config_id,
            "componentType": conf.get("componentType", "Table"),
            "tableId": conf.get("tableID") or conf.get("tableId"),
            "mapping": {},
            "styling": {},
            "actions": {}
        }
        
        # Processamento seguro dos campos JSON
        for key in ["mappingJson", "stylingJson", "actionsJson"]:
            field_name = key.replace("Json", "")
            json_str = conf.get(key)
            if json_str:
                try:
                    data = json.loads(json_str)
                    # Alguns editores salvam { "styling": { ... } } em vez de { ... }
                    if field_name == "styling" and isinstance(data, dict) and "styling" in data:
                        merged["styling"] = data["styling"]
                    else:
                        merged[field_name] = data
                except Exception as e:
                    print(f"Erro ao parsear {key}: {e}")
        
        # Flat access for older components
        if merged["mapping"]: merged.update(merged["mapping"])
        if merged["styling"]: merged.update(merged["styling"])
        if merged["actions"]: merged.update(merged["actions"])
        
        return merged

def load_menu():
    """Carrega o menu.json inicial."""
    if os.path.exists(MENU_PATH):
        try:
            with open(MENU_PATH, "r", encoding="utf-16") as f: return json.load(f)
        except:
            with open(MENU_PATH, "r", encoding="utf-8") as f: return json.load(f)
    return [
        {"category": "Engenharia", "items": [{"label": "Explorador", "icon": "", "configId": ""}]},
        {"category": "Controladoria", "items": [{"label": "Configurações", "icon": "", "configId": ""}]}
    ]

def save_menu(menu):
    with open(MENU_PATH, "w", encoding="utf-8") as f: json.dump(menu, f, indent=4, ensure_ascii=False)

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
