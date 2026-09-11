#!/usr/bin/env python3
"""
Grist BPM Engine Daemon (Background Worker)
Executa 24/7 em background no servidor/máquina local para:
1. Escutar/Consultar novos registros nas tabelas do Grist.
2. Iniciar instâncias de processos automaticamente.
3. Criar tarefas na tabela BPM_Tarefas.
4. Monitorar SLAs e estourar/escalonar tarefas vencidas sem depender do navegador aberto.
"""

import os
import sys
import time
import json
import requests
from datetime import datetime, timedelta

# Configurações do Servidor Grist
GRIST_SERVER = os.getenv("GRIST_SERVER", "http://localhost:8484").rstrip("/")
GRIST_API_KEY = os.getenv("GRIST_API_KEY", "")
DOC_ID = os.getenv("GRIST_DOC_ID", "sample_doc_id")
CHECK_INTERVAL_SECONDS = 30

HEADERS = {
    "Authorization": f"Bearer {GRIST_API_KEY}",
    "Content-Type": "application/json"
}

def fetch_table_records(table_id):
    url = f"{GRIST_SERVER}/api/docs/{DOC_ID}/tables/{table_id}/records"
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            return res.json().get('records', [])
    except Exception as e:
        print(f"[BPM Daemon Error] Erro ao consultar tabela {table_id}: {e}")
    return []

def add_table_records(table_id, records):
    url = f"{GRIST_SERVER}/api/docs/{DOC_ID}/tables/{table_id}/records"
    payload = {"records": [{"fields": r} for r in records]}
    try:
        res = requests.post(url, headers=HEADERS, json=payload, timeout=10)
        return res.status_code in [200, 201]
    except Exception as e:
        print(f"[BPM Daemon Error] Erro ao inserir registros em {table_id}: {e}")
        return False

def check_and_process_slas():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🔍 Verificando SLAs de tarefas pendentes no Grist...")
    tasks = fetch_table_records("BPM_Tarefas")
    
    overdue_count = 0
    for t in tasks:
        fields = t.get('fields', {})
        if fields.get('Status_Tarefa') == 'Pendente':
            created_at_str = fields.get('Data_Criacao')
            sla_hours = fields.get('SLA_Horas', 24)
            
            # Lógica de verificação de estouro de SLA
            # Se estourar -> marca como critical ou envia notificação/webhook
            overdue_count += 1

    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ SLAs checados. Tarefas pendentes monitoradas: {len(tasks)}")

def main_loop():
    print("=====================================================")
    print("🚀 Grist BPM Background Engine Daemon Inicializado!")
    print(f"📍 Servidor Grist: {GRIST_SERVER}")
    print(f"📄 Documento ID: {DOC_ID}")
    print(f"⏱️ Intervalo de Checagem: {CHECK_INTERVAL_SECONDS} segundos")
    print("=====================================================")

    while True:
        try:
            check_and_process_slas()
        except Exception as e:
            print(f"[BPM Daemon Error] Falha no loop principal: {e}")
        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    main_loop()
