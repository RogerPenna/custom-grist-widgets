import re, os

def fix_svg_file(path):
    if not os.path.exists(path):
        print(f"Skipping: {path} (not found)")
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    def fix_symbol(match):
        symbol_content = match.group(0)
        # Check if the symbol already has any stroke
        if 'stroke=' in symbol_content:
            return symbol_content
        
        # Add stroke and stroke-width to all paths inside this symbol
        def fix_path(p_match):
            p_tag = p_match.group(0)
            # Remove existing fill if it exists
            p_tag = re.sub(r'\sfill="[^"]*"', '', p_tag)
            # Inject new attributes
            return p_tag.replace('<path ', '<path fill="none" stroke="currentColor" stroke-width="2" ')

        return re.sub(r'<path [^>]+>', fix_path, symbol_content)

    # Find each <symbol>...</symbol> block
    new_content = re.sub(r'<symbol [^>]+>.*?</symbol>', fix_symbol, content, flags=re.DOTALL)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Fixed: {path}")

fix_svg_file('libraries/icons/icons.svg')
fix_svg_file('static/libraries/icons/icons.svg')
