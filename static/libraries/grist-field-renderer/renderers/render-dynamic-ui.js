// libraries/grist-field-renderer/renderers/render-dynamic-ui.js

export function renderDynamicUI(options) {
    const { container, cellValue, isEditing } = options;
    
    if (isEditing) {
        container.innerHTML = `<textarea class="grf-form-input" style="font-family: monospace; font-size: 11px; height: 100px;">${cellValue || ''}</textarea>`;
        const textarea = container.querySelector('textarea');
        textarea.onchange = () => options.onUpdate(textarea.value);
        return;
    }

    let data = [];
    try {
        if (!cellValue) {
            container.innerHTML = '<span class="grf-readonly-empty">(vazio)</span>';
            return;
        }
        data = typeof cellValue === 'string' ? JSON.parse(cellValue) : cellValue;
        if (!Array.isArray(data)) data = [data];
    } catch (e) {
        container.innerHTML = `<span style="color:red; font-size:11px;">JSON Error: ${e.message}</span>`;
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'grf-dynamic-ui-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '8px';
    wrapper.style.alignItems = 'center';

    data.forEach(item => {
        const el = createComponent(item);
        if (el) wrapper.appendChild(el);
    });

    container.appendChild(wrapper);
}

function createComponent(item) {
    if (!item || !item.type) return null;

    switch (item.type.toLowerCase()) {
        case 'pill': return createPill(item);
        case 'progress': return createProgress(item);
        case 'icon': return createIcon(item);
        case 'stat': return createStat(item);
        case 'text': return createText(item);
        default: return null;
    }
}

function createPill(item) {
    const span = document.createElement('span');
    span.className = 'grf-dynamic-pill';
    span.textContent = item.label || '';
    span.style.cssText = `
        display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 12px;
        font-size: 11px; font-weight: 700; white-space: nowrap;
        background-color: ${item.color || '#e2e8f0'};
        color: ${item.textColor || '#1e293b'};
    `;
    if (item.icon) {
        const icon = createIcon({ name: item.icon, size: '12px', color: item.textColor || '#1e293b' });
        if (icon) {
            icon.style.marginRight = '4px';
            span.prepend(icon);
        }
    }
    return span;
}

function createProgress(item) {
    const div = document.createElement('div');
    div.style.width = item.width || '100px';
    const val = Number(item.value) || 0;
    div.innerHTML = `
        <div class="grf-progress-wrapper" style="height: 12px; margin-bottom: 2px;">
            <div class="grf-progress-bar" style="width: ${val}%; background-color: ${item.color || '#3b82f6'};"></div>
        </div>
        ${item.label ? `<div style="font-size: 10px; color: #64748b; font-weight: 700; text-align: center;">${item.label}</div>` : ''}
    `;
    return div;
}

function createIcon(item) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.style.width = item.size || '16px';
    svg.style.height = item.size || '16px';
    svg.style.fill = 'none';
    svg.style.stroke = item.color || 'currentColor';
    svg.style.strokeWidth = '2';
    
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${item.name}`);
    svg.appendChild(use);
    
    return svg;
}

function createStat(item) {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; flex-direction: column; line-height: 1.2;';
    div.innerHTML = `
        <div style="font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase;">${item.label || ''}</div>
        <div style="font-size: 16px; font-weight: 800; color: #1e293b;">${item.value || ''}</div>
        ${item.subtext ? `<div style="font-size: 10px; color: ${item.subtextColor || '#64748b'};">${item.subtext}</div>` : ''}
    `;
    return div;
}

function createText(item) {
    const span = document.createElement('span');
    span.textContent = item.text || '';
    span.style.cssText = `
        font-size: ${item.size || '12px'};
        font-weight: ${item.bold ? '700' : '400'};
        color: ${item.color || 'inherit'};
    `;
    return span;
}
