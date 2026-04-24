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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
            
            /* Reset e Fundo Global */
            .stApp {{ 
                background-color: {STITCH['bg']}; 
                color: {STITCH['text']}; 
                font-family: 'Inter', sans-serif; 
            }}
            
            /* Sidebar Customizada */
            [data-testid="stSidebar"], [data-testid="stSidebarNav"] {{ 
                background-color: {STITCH['panel']} !important; 
                border-right: 1px solid {STITCH['border']}; 
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
                color: {STITCH['text_dim']} !important; 
                text-align: left; 
                padding: 0.6rem 1rem; 
                transition: all 0.2s;
                border-radius: 6px;
                font-weight: 500;
                font-family: 'Material Icons', 'Inter', sans-serif;
            }}
            .stButton > button:hover {{ color: white !important; background: rgba(255,255,255,0.05); }}
            
            /* Expanders */
            .stExpander {{
                background-color: {STITCH['panel']} !important;
                border: 1px solid {STITCH['border']} !important;
            }}
            
            /* Labels de Input */
            .stTextInput label, .stSelectbox label {{
                color: {STITCH['text_dim']} !important;
            }}

            /* Tabs */
            .stTabs [data-baseweb="tab-list"] {{ border-bottom: 1px solid {STITCH['border']}; }}
            .stTabs [data-baseweb="tab"] {{ color: {STITCH['text_dim']} !important; font-weight: 700; }}
            .stTabs [aria-selected="true"] {{ color: {STITCH['primary']} !important; }}

            /* Esconder elementos nativos do Streamlit que poluem a UI industrial */
            #MainMenu {{ visibility: hidden; }}
            footer {{ visibility: hidden; }}
            header {{ visibility: hidden; }}
        </style>
    """, unsafe_allow_html=True)
