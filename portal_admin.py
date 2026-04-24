import streamlit as st
import os
import base64
import json
from app_data import GristClient, load_menu, save_menu, strip_accents, LOGO_PATH
from app_styles import STITCH, apply_custom_styles

# --- INICIALIZAÇÃO ---
grist = GristClient()

if 'menu_structure' not in st.session_state:
    st.session_state.menu_structure = load_menu()
if 'logo_b64' not in st.session_state:
    if os.path.exists(LOGO_PATH):
        try:
            with open(LOGO_PATH, "r") as f: st.session_state.logo_b64 = f.read()
        except:
            st.session_state.logo_b64 = None
    else: st.session_state.logo_b64 = None
if 'current_page' not in st.session_state:
    st.session_state.current_page = "Dashboard"
if 'active_category' not in st.session_state:
    st.session_state.active_category = None
if 'active_config_id' not in st.session_state:
    st.session_state.active_config_id = None

# --- CONFIGURAÇÃO E ESTILO ---
st.set_page_config(page_title="Pavicon PQC - Industrial Portal", layout="wide", initial_sidebar_state="expanded")
apply_custom_styles()

# --- SIDEBAR ---
with st.sidebar:
    if st.session_state.logo_b64:
        st.markdown(f'<div style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem 0; margin-bottom: 0.5rem;"><img src="data:image/png;base64,{st.session_state.logo_b64}" style="max-width: 85%; max-height: 50px;"></div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div style="text-align: center; padding: 1rem 0; color: white; font-weight: 800; font-size: 20px;">PAVICON OS</div>', unsafe_allow_html=True)

    def menu_item(label, icon, key_prefix="menu_", configId=""):
        safe_label = "".join(c for c in strip_accents(label) if c.isalnum())
        key = f"{key_prefix}{safe_label}"
        
        # Estilo de botão ativo
        if st.session_state.current_page == label:
            st.markdown(f'<style>div[class*="st-key-{key}"] button {{ background-color: {STITCH["primary"]} !important; color: white !important; font-weight: 700 !important; }}</style>', unsafe_allow_html=True)
        
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
        
        if st.button(cat_name.upper(), key=key):
            st.session_state.active_category = None if is_expanded else cat_name
            st.rerun()
            
        if is_expanded:
            for item in cat["items"]:
                menu_item(item["label"], item["icon"], key_prefix="sub_", configId=item.get("configId", ""))

    st.markdown("<div style='margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;'></div>", unsafe_allow_html=True)
    menu_item("Configurações", "")

# --- TOP BAR ---
st.markdown(f'''
    <div class="stitch-top-bar">
        <div style="font-size: 13px; color: #94a3b8;">Home > <span style="color: white; font-weight: 600;">{st.session_state.current_page}</span></div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: white;">Rogerio Penna</div>
                <div style="font-size: 10px; color: #40e0d0;">Admin Mode</div>
            </div>
            <div style="width: 32px; height: 32px; background: {STITCH['primary']}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; color: white;">RP</div>
        </div>
    </div>
''', unsafe_allow_html=True)

# --- FUNÇÃO DE INJEÇÃO DINÂMICA (A MÁGICA) ---
def render_dynamic_widget(config_id):
    """Injeta os renderizadores JS e os dados diretamente no Streamlit."""
    config = grist.get_config(config_id)
    if not config:
        st.error(f"Configuração {config_id} não encontrada.")
        return

    records = grist.get_records(config['tableId'])
    
    # Prepara o HTML com injeção de dados e scripts locais
    # Usamos string templates normais em vez de f-strings para o JS para evitar conflitos com chaves {}
    widget_html = '''
        <div id="universal-widget-root" style="width: 100%; height: 800px; background: ''' + STITCH['panel'] + '''; border-radius: 12px; border: 1px solid ''' + STITCH['border'] + '''; overflow: hidden;">
            <div id="renderer-container" style="height: 100%; padding: 20px;">
                <div style="color: #64748b; text-align: center; padding-top: 100px;">Carregando Motor de Renderização...</div>
            </div>
        </div>

        <!-- Injeção de Dados -->
        <script>
            window.WIDGET_DATA = {
                records: ''' + json.dumps(records) + ''',
                config: ''' + json.dumps(config) + '''
            };
            console.log("[Portal Admin] Dados injetados com sucesso.", window.WIDGET_DATA);
        </script>

        <!-- Importação das Bibliotecas -->
        <script type="module">
            import { TableRenderer } from "http://localhost:3000/libraries/grist-table-renderer/TableRenderer.js";
            import { CardSystem } from "http://localhost:3000/libraries/grist-card-system/CardSystem.js";
            
            const container = document.getElementById('renderer-container');
            const { config, records } = window.WIDGET_DATA;
            const type = (config.componentType || "").replace(/\\s+/g, "").toLowerCase();

            try {
                container.innerHTML = "";

                // MOCK TABLE LENS PARA MODO INJEÇÃO DIRETA
                const mockTableLens = {
                    getTableSchema: (tableId) => Promise.resolve(window.WIDGET_DATA.schema || {}),
                    fetchTableRecords: (tableId) => Promise.resolve(records),
                    updateRecord: (t, r, d) => console.log("Edição direta não habilitada no Portal Admin"),
                    fetchConfig: (id) => Promise.resolve(config)
                };

                if (type === "table") {
                    await TableRenderer.renderTable({
                        container: container,
                        records: records,
                        config: config,
                        tableLens: mockTableLens
                    });
                } else if (type === "cardsystem" || type === "cardviewer") {
                    await CardSystem.renderCards(container, records, config, window.WIDGET_DATA.schema || {});
                } else {
                    container.innerHTML = "<div style='color: white; padding: 20px;'>Tipo de widget '" + type + "' ainda não suportado via injeção direta.</div>";
                }
            } catch (e) {
                container.innerHTML = "<div style='color: red; padding: 20px;'>Erro na renderização: " + e.message + "</div>";
            }
        </script>
    '''
    st.components.v1.html(widget_html, height=850)

# --- CONTEÚDO PRINCIPAL ---
if st.session_state.current_page == "Configurações":
    st.markdown("<h2 style='font-weight: 900; color: white;'>Configurações</h2>", unsafe_allow_html=True)
    tab_modules, tab_configurator = st.tabs(["Menu e Módulos", "Configurador"])

    with tab_modules:
        menu = st.session_state.menu_structure
        for i, cat in enumerate(menu):
            with st.expander(f"Categoria: {cat['category']}", expanded=True):
                cat['category'] = st.text_input("Nome", cat['category'], key=f"cat_in_{i}")
                for j, item in enumerate(cat['items']):
                    c1, c2, c3, c4 = st.columns([1, 2, 3, 1])
                    item['icon'] = c1.text_input("Icon", item['icon'], key=f"ico_{i}_{j}")
                    item['label'] = c2.text_input("Label", item['label'], key=f"lbl_{i}_{j}")
                    item['configId'] = c3.text_input("ID", item.get('configId', ''), key=f"cid_{i}_{j}")
                    if c4.button("🗑️", key=f"del_{i}_{j}"):
                        cat['items'].pop(j); save_menu(menu); st.rerun()
                if st.button("➕ Adicionar", key=f"add_{i}"):
                    cat['items'].append({"label": "Novo", "icon": "📄", "configId": ""}); save_menu(menu); st.rerun()
        if st.button("💾 Salvar Menu Estruturado", type="primary"): save_menu(menu); st.success("Estrutura de Menu Salva!")

    with tab_configurator:
        doc_id = os.getenv("GRIST_DOC_ID", "qiVPiRA3ULcU")
        st.components.v1.html(f'<iframe src="http://localhost:3000/configurator.html?docId={doc_id}" style="width:100%; height:80vh; border:none; border-radius: 12px; background: white;"></iframe>', height=800)

elif st.session_state.current_page == "Explorador":
    tables = grist.get_tables()
    sel = st.selectbox("Selecione a Tabela para Exploração Rápida", options=[t["id"] for t in tables])
    if sel:
        recs = grist.get_records(sel)
        st.dataframe(recs, use_container_width=True, hide_index=True)

elif st.session_state.current_page == "Dashboard":
    st.markdown("<h2 style='color: white;'>Painel de Controle</h2>", unsafe_allow_html=True)
    st.info("Bem-vindo ao Portal Administrativo Industrial da Pavicon.")

else:
    config_id = st.session_state.active_config_id
    if config_id:
        render_dynamic_widget(config_id)
    else:
        st.warning(f"O módulo '{st.session_state.current_page}' não possui um ID de configuração vinculado.")
