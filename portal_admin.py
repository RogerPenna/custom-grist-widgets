import streamlit as st
import pandas as pd
import os
import base64
import json
import requests
import subprocess
import time
import socket
import sys
from dotenv import load_dotenv

# --- 0. CONFIGURAÇÕES E AMBIENTE ---
load_dotenv()
CONFIG_DIR = "app_config"
LOGO_PATH = os.path.join(CONFIG_DIR, "custom_logo.txt")

def load_logo_from_disk():
    if os.path.exists(LOGO_PATH):
        try:
            with open(LOGO_PATH, "r") as f: return f.read()
        except: return None
    return None

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_static_server():
    """Inicia o servidor de ponte (proxy) na porta 3000 se não estiver rodando."""
    if not is_port_in_use(3000):
        proxy_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proxy_server.py")
        subprocess.Popen([sys.executable, proxy_path], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        time.sleep(2)

# Iniciar servidor estático/ponte
start_static_server()

# --- 1. TEMA CONGELADO STITCH ---
STITCH = {
    "sidebar_bg": "#12182C",
    "top_bar_bg": "#12182C",
    "main_bg": "#f8fafc",
    "primary": "#0f3bbd",
    "text_dark": "#8F9BA8",
    "text_light": "#ffffff",
    "text_muted": "#8F9BA8",
    "border": "#EAEEF3"
}

# --- 2. ESTADO ---
if 'logo_b64' not in st.session_state or st.session_state.logo_b64 is None:
    st.session_state.logo_b64 = load_logo_from_disk()
if 'current_page' not in st.session_state:
    st.session_state.current_page = "Dashboard"

# --- 3. CONFIGURAÇÃO DA PÁGINA ---
st.set_page_config(page_title="Pavicon PQC", layout="wide", initial_sidebar_state="expanded")

# --- 4. CSS GLOBAL ---
st.markdown(f"""
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
    <style>
        .stApp {{ background-color: {STITCH['main_bg']}; font-family: 'Manrope', sans-serif; }}
        [data-testid="stSidebar"] {{ background-color: {STITCH['sidebar_bg']} !important; border-right: 1px solid rgba(255,255,255,0.05); }}
        
        /* Ocultar Elementos Streamlit */
        header[data-testid="stHeader"] {{ background: transparent !important; height: 0px !important; z-index: 0; }}
        [data-testid="stSidebarNav"] {{ display: none !important; }}
        [data-testid="stSidebarHeader"] {{ height: 1rem !important; padding: 0 !important; }}
        .stDeployButton {{ display: none !important; }}
        #MainMenu {{ display: none !important; }}
        footer {{ visibility: hidden !important; }}

        /* ALINHAMENTO SIDEBAR */
        [data-testid="stSidebarContent"], [data-testid="stSidebarContent"] > div:first-child {{
            padding-top: 0rem !important; margin-top: 0rem !important;
        }}
        [data-testid="stSidebarContent"] [data-testid="stVerticalBlock"] > div {{ width: 100% !important; }}
        
        /* Main Content Padding Fix */
        .block-container {{ 
            padding-top: 64px !important; 
            margin-top: 0rem !important; 
        }}

        /* --- SIDEBAR BUTTONS --- */
        [data-testid="stSidebar"] div.stButton {{ width: 100% !important; padding: 0 12px !important; }}
        [data-testid="stSidebar"] button {{
            width: 100% !important; border-radius: 8px !important; border: none !important;
            background-color: transparent !important; text-align: left !important; 
            padding: 0.8rem 1.2rem !important; font-size: 14px !important;
            font-weight: 500 !important; display: flex !important; align-items: center !important;
            justify-content: flex-start !important; gap: 12px !important; transition: all 0.2s ease !important;
            margin-bottom: 4px !important; box-shadow: none !important;
        }}
        
        /* Cor do texto dos botões não selecionados */
        [data-testid="stSidebar"] button p {{ color: {STITCH['text_muted']} !important; }}
        
        [data-testid="stSidebar"] button div:first-child {{ justify-content: flex-start !important; text-align: left !important; width: 100% !important; }}
        [data-testid="stSidebar"] button:hover {{ background-color: rgba(255,255,255,0.05) !important; }}
        [data-testid="stSidebar"] button:hover p {{ color: white !important; }}

        /* --- BOTÕES DA ÁREA PRINCIPAL --- */
        [data-testid="stMain"] button {{
            background-color: {STITCH['primary']} !important; color: {STITCH['text_light']} !important;
            border-radius: 8px !important; padding: 0.5rem 1.2rem !important; font-weight: 700 !important; border: none !important;
        }}

        /* TOP BAR FIXA NO TOPO */
        .stitch-top-bar {{
            background-color: {STITCH['top_bar_bg']}; 
            height: 64px; 
            display: flex;
            align-items: center; 
            justify-content: space-between; 
            padding: 0 2rem;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            color: white;
        }}

        /* Forms & Typography */
        h1, h2, h3, p, label, span {{ color: {STITCH['text_dark']}; }}
        div[data-baseweb="select"] > div {{
            background-color: #ffffff !important; color: #1e293b !important;
            border: 1px solid {STITCH['border']} !important; border-radius: 8px !important;
        }}
    </style>
""", unsafe_allow_html=True)

# --- 5. SIDEBAR ---
with st.sidebar:
    if st.session_state.logo_b64:
        st.markdown(f'<div style="margin-top: 0px; padding: 0.2rem 0; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 1rem;"><img src="data:image/png;base64,{st.session_state.logo_b64}" style="max-width: 85%; max-height: 50px; object-fit: contain;"></div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div style="margin-top: 0px; padding: 0.5rem 0; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 1rem;"><div style="color: white; font-weight: 800; font-size: 18px; letter-spacing: 2px;">PAVICON PQC</div></div>', unsafe_allow_html=True)

    def stitch_menu(label, icon, is_active=False):
        safe_label = "".join(c for c in label if c.isalnum())
        if is_active:
            st.markdown(f'<style>div[class*="st-key-menu_{safe_label}"] button {{ background-color: {STITCH["primary"]} !important; }} div[class*="st-key-menu_{safe_label}"] button p {{ color: white !important; font-weight: 700 !important; }}</style>', unsafe_allow_html=True)
        if st.button(f"{icon}  {label}", key=f"menu_{safe_label}"):
            st.session_state.current_page = label
            st.rerun()

    st.markdown("<div style='color: #475569; font-size: 10px; font-weight: 800; margin: 1rem 0 0.5rem 1.2rem; letter-spacing: 1px;'>MENU</div>", unsafe_allow_html=True)
    stitch_menu("Dashboard", "", st.session_state.current_page == "Dashboard")
    stitch_menu("Explorador", "", st.session_state.current_page == "Explorador")
    stitch_menu("Configurador", "", st.session_state.current_page == "Configurador")
    stitch_menu("Configurações", "", st.session_state.current_page == "Configurações")

def render_header():
    st.markdown(f"""
        <div class="stitch-top-bar">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;">
                <span style="opacity: 0.5;">Home</span>
                <span class="material-symbols-outlined" style="font-size: 16px; opacity: 0.3;">chevron_right</span>
                <span>{st.session_state.current_page}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 20px;">
                <span class="material-symbols-outlined" style="opacity: 0.5; cursor: pointer;">search</span>
                <span class="material-symbols-outlined" style="opacity: 0.5; cursor: pointer;">notifications</span>
                <div style="display: flex; align-items: center; gap: 10px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                    <div style="text-align: right;">
                        <div style="font-size: 12px; font-weight: 700; color: white;">Alex Jensen</div>
                        <div style="font-size: 10px; opacity: 0.5; color: white;">ADMINISTRATOR</div>
                    </div>
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #232c48;"></div>
                </div>
            </div>
        </div>
    """, unsafe_allow_html=True)

# --- 7. RENDERIZAÇÃO ---
render_header()

if st.session_state.current_page == "Dashboard":
    st.markdown(f"<h2 style='font-weight: 900; letter-spacing: -1px; margin-bottom: 0; color: #0f172a;'>Project Workspace</h2>", unsafe_allow_html=True)
    st.markdown(f"<p style='color: #64748b; margin-bottom: 2rem;'>Manage your team projects and monitor progress across departments.</p>", unsafe_allow_html=True)
    
    c1, c2, c3, c4 = st.columns(4)
    for label in ["Active Projects", "Total Tasks", "Budget Used", "System Load"]:
        with st.container():
            st.markdown(f"""
                <div style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid {STITCH['border']};">
                    <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">{label}</div>
                    <div style="font-size: 24px; font-weight: 900; color: #0f172a;">--</div>
                </div>
            """, unsafe_allow_html=True)

elif st.session_state.current_page == "Configurador":
    raw_doc_id = os.getenv("GRIST_DOC_ID", "")
    doc_id = raw_doc_id.split("/")[-1] if "/" in raw_doc_id else raw_doc_id
    config_url = f"http://localhost:3000/configurator.html?docId={doc_id}"
    st.components.v1.html(f"""
        <iframe src="{config_url}" style="width:100%; height:85vh; border:none; border-radius: 12px; background: white;"></iframe>
    """, height=850)

else:
    st.info(f"O módulo {st.session_state.current_page} está sendo preparado.")
