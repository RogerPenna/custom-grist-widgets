import streamlit as st

# Paleta de Cores Industrial (Pavicon OS)
STITCH = {
    "bg": "#0b1020",      # Fundo Principal
    "panel": "#121a2f",   # Painéis e Sidebar
    "primary": "#3b82f6", # Azul Pavicon
    "text": "#f8fafc",    # Texto Claro
    "text_dim": "#94a3b8",# Texto Secundário
    "border": "#1e293b",  # Bordas Sutis
    "success": "#22c55e",
    "danger": "#ef4444"
}

def apply_custom_styles():
    """Aplica o CSS Industrial ao Streamlit."""
    st.markdown(f"""
        <style>
            /* Reset e Fundo Global */
            .stApp {{ background-color: {STITCH['bg']}; color: {STITCH['text']}; font-family: 'Inter', sans-serif; }}
            
            /* Sidebar Customizada */
            [data-testid="stSidebar"] {{ 
                background-color: {STITCH['panel']}; 
                border-right: 1px solid {STITCH['border']}; 
                padding-top: 0;
            }}
            
            /* Top Bar de Estilo Industrial */
            .stitch-top-bar {{ 
                background: {STITCH['panel']}; 
                padding: 10px 25px; 
                border-bottom: 1px solid {STITCH['border']}; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 20px;
                position: sticky;
                top: 0;
                z-index: 1000;
            }}

            /* Botões do Menu Lateral */
            .stButton > button {{ 
                width: 100%; 
                background: transparent; 
                border: none; 
                color: {STITCH['text_dim']}; 
                text-align: left; 
                padding: 0.6rem 1rem; 
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                border-radius: 6px;
                font-weight: 500;
            }}
            .stButton > button:hover {{ color: white; background: rgba(255,255,255,0.05); }}
            
            /* Inputs e Formulários */
            .stTextInput > div > div > input {{ background: {STITCH['bg']}; color: white; border-color: {STITCH['border']}; }}
            
            /* Tabs Estilizadas */
            .stTabs [data-baseweb="tab-list"] {{ gap: 24px; background-color: transparent; }}
            .stTabs [data-baseweb="tab"] {{ color: {STITCH['text_dim']}; padding: 10px 0; font-weight: 700; }}
            .stTabs [aria-selected="true"] {{ color: {STITCH['primary']} !important; }}

            /* Scrollbars */
            ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
            ::-webkit-scrollbar-track {{ background: {STITCH['bg']}; }}
            ::-webkit-scrollbar-thumb {{ background: {STITCH['border']}; border-radius: 10px; }}
            ::-webkit-scrollbar-thumb:hover {{ background: {STITCH['text_dim']}; }}
        </style>
    """, unsafe_allow_html=True)
