import streamlit as st
import os
import base64
from app_data import GristClient, load_menu, save_menu, start_static_server, strip_accents, LOGO_PATH
from app_styles import STITCH, apply_custom_styles

# --- INICIALIZAÇÃO ---
# O proxy_server.py deve ser iniciado via CENTRAL_DE_COMANDOS.bat na porta 3000
grist = GristClient()

if 'menu_structure' not in st.session_state:
    st.session_state.menu_structure = load_menu()
if 'logo_b64' not in st.session_state:
    if os.path.exists(LOGO_PATH):
        with open(LOGO_PATH, "r") as f: st.session_state.logo_b64 = f.read()
    else: st.session_state.logo_b64 = None
if 'current_page' not in st.session_state:
    st.session_state.current_page = "Dashboard"
if 'active_category' not in st.session_state:
    st.session_state.active_category = None

# --- CONFIGURAÇÃO E ESTILO ---
st.set_page_config(page_title="Pavicon PQC", layout="wide", initial_sidebar_state="expanded")
apply_custom_styles()

# --- SIDEBAR ---
with st.sidebar:
    if st.session_state.logo_b64:
        st.markdown(f'<div style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0; margin-bottom: 0.5rem;"><img src="data:image/png;base64,{st.session_state.logo_b64}" style="max-width: 85%; max-height: 50px;"></div>', unsafe_allow_html=True)
    else:
        st.markdown('<div style="text-align: center; padding: 1rem 0; color: white; font-weight: 800;">PAVICON PQC</div>', unsafe_allow_html=True)

    def menu_item(label, icon, key_prefix="menu_", configId=""):
        safe_label = "".join(c for c in strip_accents(label) if c.isalnum())
        key = f"{key_prefix}{safe_label}"
        if st.session_state.current_page == label:
            st.markdown(f'<style>div[class*="st-key-{key}"] button {{ background-color: {STITCH["primary"]} !important; }} div[class*="st-key-{key}"] button p {{ color: white !important; font-weight: 700 !important; }}</style>', unsafe_allow_html=True)
        if st.button(f"{icon}  {label}", key=key):
            st.session_state.current_page = label
            st.session_state.active_config_id = configId
            st.rerun()

    menu_item("Dashboard", "")
    menu_item("Explorador", "")

    for cat in st.session_state.menu_structure:
        cat_name = cat["category"]
        is_expanded = st.session_state.active_category == cat_name
        key = f"cat_{cat_name.replace(' ', '')}"
        if is_expanded: st.markdown(f'<style>div[class*="st-key-{key}"] button:after {{ transform: rotate(180deg) !important; color: white !important; }}</style>', unsafe_allow_html=True)
        if st.button(cat_name.upper(), key=key):
            st.session_state.active_category = None if is_expanded else cat_name
            st.rerun()
        if is_expanded:
            for item in cat["items"]:
                menu_item(item["label"], item["icon"], key_prefix="sub_", configId=item.get("configId", ""))

    st.markdown("<div style='margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;'></div>", unsafe_allow_html=True)
    menu_item("Configurações", "")

# --- TOP BAR ---
st.markdown(f'<div class="stitch-top-bar"><div style="font-size: 13px;">Home > {st.session_state.current_page}</div><div style="font-size: 12px; font-weight: 700;">Alex Jensen</div></div>', unsafe_allow_html=True)

# --- CONTEÚDO PRINCIPAL ---
if st.session_state.current_page == "Configurações":
    st.markdown("<h2 style='font-weight: 900; color: #0f172a;'>Configurações</h2>", unsafe_allow_html=True)
    tab_modules, tab_configurator, tab_general = st.tabs(["Menu e Módulos", "Configurador", "Geral"])

    with tab_modules:
        menu = st.session_state.menu_structure
        for i, cat in enumerate(menu):
            with st.expander(f"Categoria: {cat['category']}", expanded=True):
                cat['category'] = st.text_input("Nome", cat['category'], key=f"cat_in_{i}")
                for j, item in enumerate(cat['items']):
                    c1, c2, c3, c4 = st.columns([1, 2, 3, 1])
                    item['icon'] = c1.text_input("Ícone", item['icon'], key=f"ico_{i}_{j}")
                    item['label'] = c2.text_input("Rótulo", item['label'], key=f"lbl_{i}_{j}")
                    item['configId'] = c3.text_input("ID", item.get('configId', ''), key=f"cid_{i}_{j}")
                    if c4.button("🗑️", key=f"del_{i}_{j}"):
                        cat['items'].pop(j); save_menu(menu); st.rerun()
                if st.button("➕ Adicionar", key=f"add_{i}"):
                    cat['items'].append({"label": "Novo", "icon": "📄", "configId": ""}); save_menu(menu); st.rerun()
        if st.button("💾 Salvar Menu", type="primary"): save_menu(menu); st.success("Salvo!")

    with tab_configurator:
        doc_id = os.getenv("GRIST_DOC_ID", "").split("/")[-1]
        st.components.v1.html(f'<iframe src="http://localhost:3000/configurator.html?docId={doc_id}" style="width:100%; height:80vh; border:none; border-radius: 8px; background: white;"></iframe>', height=800)

    with tab_general:
        new_logo = st.file_uploader("Trocar Logo", type=["png", "jpg"])
        if new_logo:
            b64 = base64.b64encode(new_logo.read()).decode()
            with open(LOGO_PATH, "w") as f: f.write(b64)
            st.session_state.logo_b64 = b64; st.success("Logo atualizado!"); st.rerun()

elif st.session_state.current_page == "Explorador":
    tables = grist.get_tables()
    sel = st.selectbox("Tabela", options=[t["id"] for t in tables], format_func=lambda x: x)
    if sel: st.dataframe(grist.get_records(sel), use_container_width=True, hide_index=True)

else:
    config_id = getattr(st.session_state, "active_config_id", "")
    if config_id:
        import time
        doc_id = os.getenv("GRIST_DOC_ID", "").split("/")[-1]
        widget_url = f"http://localhost:3000/widgets/CardViewer.html?configId={config_id}&docId={doc_id}&v={time.time()}"
        # Renderiza APENAS o iframe, ocupando 100% da largura e altura definida no CSS
        st.components.v1.html(f'<iframe src="{widget_url}" style="width:100%; height:100vh; border:none; margin:0; padding:0;"></iframe>', height=1000)
    else:
        st.info(f"O módulo {st.session_state.current_page} não tem configuração.")
