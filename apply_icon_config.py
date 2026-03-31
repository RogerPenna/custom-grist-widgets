import re, os, json

config = {
  "icon-link": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-link-broken": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-settings": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-edit": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-save": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-save-alt": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-adjustments": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-adjustments-vert": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-annotation": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-badge-check": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-barcode": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-bars": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-bell": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-bell-active": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-bookmark": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-calendar-edit": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-chart": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-chart-mixed": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-chart-pie": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-check": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-check-circle": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-check-circle-alt": {"fill": True, "stroke": False, "strokeWidth": 1.5},
  "icon-minus-circle": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-minus-circle-alt": {"fill": True, "stroke": False, "strokeWidth": 1.5},
  "icon-plus-circle": {"fill": True, "stroke": False, "strokeWidth": 1.5},
  "icon-plus-circle-alt": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-clipboard": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-clipboard-check": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-clipboard-list": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-clock-arrow": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-close-circle": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-close-sidebar": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-column": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-download": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-exclamation": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-expand": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-eye": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-file": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-file-chart": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-file-check": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-file-clone": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-file-search": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-filter": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-flag": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-folder": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-forward": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-globe": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-grid": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-hourglass": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-info-circle": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-lightbulb": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-lifesaver": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-lock": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-unlock": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-microscope": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-pen": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-printer": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-profile-card": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-rectangle-list": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-tools": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-trashbin": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-truck": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-zoom-in": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-zoom-out": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-chart-up": {"fill": False, "stroke": True, "strokeWidth": 2},
  "icon-arrow-move": {"fill": True, "stroke": True, "strokeWidth": 0.5},
  "icon-bar-chart": {"fill": True, "stroke": False, "strokeWidth": 0.5},
  "icon-bar-chart-line": {"fill": True, "stroke": True, "strokeWidth": 0.5},
  "icon-bullseye": {"fill": True, "stroke": True, "strokeWidth": 0.1},
  "icon-card-checklist": {"fill": False, "stroke": True, "strokeWidth": 1},
  "icon-compass": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-cone": {"fill": False, "stroke": True, "strokeWidth": 1.2},
  "icon-cone-striped": {"fill": False, "stroke": True, "strokeWidth": 1.5},
  "icon-diagram-2": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-diagram-3": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-exclamation-triangle": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-exclamation-diamond": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-globe-americas": {"fill": True, "stroke": False, "strokeWidth": 0.4},
  "icon-lightning": {"fill": True, "stroke": False, "strokeWidth": 0.9},
  "icon-pen-alt": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-speedometer": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-traffic-light": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-wrench": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-search": {"fill": True, "stroke": True, "strokeWidth": 0.3},
  "icon-process-cogs": {"fill": True, "stroke": False, "strokeWidth": 0},
  "icon-process": {"fill": True, "stroke": True, "strokeWidth": 1}
}

def apply_config(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    def update_symbol(match):
        symbol_tag = match.group(1)
        symbol_id = re.search(r'id="([^"]+)"', symbol_tag).group(1)
        inner_content = match.group(2)
        
        if symbol_id not in config:
            return match.group(0)
        
        c = config[symbol_id]
        
        def update_path(p_match):
            p_tag = p_match.group(0)
            # Remove existing fill, stroke, stroke-width, linecap, linejoin
            p_tag = re.sub(r'\sfill="[^"]*"', '', p_tag)
            p_tag = re.sub(r'\sstroke="[^"]*"', '', p_tag)
            p_tag = re.sub(r'\sstroke-width="[^"]*"', '', p_tag)
            p_tag = re.sub(r'\sstroke-linecap="[^"]*"', '', p_tag)
            p_tag = re.sub(r'\sstroke-linejoin="[^"]*"', '', p_tag)
            
            new_attrs = f' fill="{ "currentColor" if c["fill"] else "none" }"'
            if c["stroke"]:
                new_attrs += f' stroke="currentColor" stroke-width="{c["strokeWidth"]}" stroke-linecap="round" stroke-linejoin="round"'
            
            return p_tag.replace('<path', f'<path{new_attrs}')

        updated_inner = re.sub(r'<path [^>]+>', update_path, inner_content)
        # Also handle cases with groups <g> if they have fill/stroke (less common but possible)
        updated_inner = re.sub(r'<g ([^>]+)>', lambda m: re.sub(r'\sfill="[^"]*"', '', m.group(0)).replace('<g', f'<g fill="{ "currentColor" if c["fill"] else "none" }"'), updated_inner)
        
        return f'{symbol_tag}>{updated_inner}</symbol>'

    new_content = re.sub(r'(<symbol [^>]+>)(.*?)(</symbol>)', update_symbol, content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Applied config to: {path}")

apply_config('libraries/icons/icons.svg')
apply_config('static/libraries/icons/icons.svg')
