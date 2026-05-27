import re, os, json

config = {
  "icon-link": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-link-broken": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-settings": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-edit": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-save": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-save-alt": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-adjustments": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-adjustments-vert": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-annotation": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-badge-check": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-barcode": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-bars": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-bell": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-bell-active": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-bookmark": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-calendar": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-calendar-edit": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chart": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chart-mixed": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chart-pie": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-check": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-check-circle": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-check-circle-alt": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-minus-circle": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-minus-circle-alt": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-plus-circle": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-plus-circle-alt": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-clipboard": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-clipboard-check": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-clipboard-list": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-clock-arrow": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-close-circle": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-close-sidebar": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-column": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-download": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-exclamation": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-expand": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-eye": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-file": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-file-chart": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-file-check": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-file-clone": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-file-search": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-filter": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-flag": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-folder": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-forward": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-globe": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-grid": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-hourglass": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-info-circle": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-lightbulb": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-lifesaver": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-lock": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-unlock": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-microscope": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-pen": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-printer": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-profile-card": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-rectangle-list": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-tools": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-trashbin": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-truck": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-zoom-in": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-zoom-out": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chart-up": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-move": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.5
  },
  "icon-bar-chart": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-bar-chart-line": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.5
  },
  "icon-bullseye": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.1
  },
  "icon-card-checklist": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1
  },
  "icon-compass": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-cone": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-cone-striped": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.5
  },
  "icon-diagram-2": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-diagram-3": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-exclamation-triangle": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-exclamation-diamond": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-globe-americas": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-lightning": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.2
  },
  "icon-pen-alt": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-speedometer": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-traffic-light": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-wrench": {
    "fill": true,
    "stroke": false,
    "strokeWidth": 2
  },
  "icon-search": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.3
  },
  "icon-process-cogs": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 0.5
  },
  "icon-process": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-sheet-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chess-knight-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chess-pawn-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chess-rook-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-traffic-cone-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-printer-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-kanban": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-chart-gantt-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-land-plot-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-landmark-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-calculator-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-tools2": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-tool-case-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-pocket-knife-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-shovel-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-crosshair-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-target-arrow": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-backhoe": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.8
  },
  "icon-bulldozer": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 1.8
  },
  "icon-CompassRose": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-hard-hat": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-down-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-down-left-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-left-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-up-left-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-up-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-up-right-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-right-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-arrow-down-right-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-strategy": {
    "fill": true,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-checklist": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-risk": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-trophy-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-activity-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-flag-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-user-round-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-shield-alert-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  },
  "icon-life-buoy-icon": {
    "fill": false,
    "stroke": true,
    "strokeWidth": 2
  }
}
}
}
}
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
