// libraries/grist-config-manager/editors/config-color-options.js

export const ColorOptionsConfigEditor = (() => {
    let state = {
        colors: []
    };

    function hexToRgb(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const bigint = parseInt(h, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        const styling = config.styling || config || {};
        state.colors = styling.colors || [
            { hex: '#3b82f6', label: 'Blue' },
            { hex: '#ef4444', label: 'Red' }
        ];

        container.innerHTML = `
            <div class="config-section">
                <h3>Paleta de Cores (Design System)</h3>
                <p class="help-text">Defina uma lista de cores. A ordem é importante para importação em outros componentes.</p>
                
                <div class="color-palette-table-container" style="margin-top: 15px;">
                    <table class="grf-setup-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; text-align: left;">
                                <th style="padding: 8px; width: 30px;"></th>
                                <th style="padding: 8px; font-size: 11px; width: 120px;">HEXADECIMAL</th>
                                <th style="padding: 8px; font-size: 11px; width: 140px;">RGB (R, G, B)</th>
                                <th style="padding: 8px; font-size: 11px; width: 60px; text-align: center;">COR</th>
                                <th style="padding: 8px; font-size: 11px;">RÓTULO (OPCIONAL)</th>
                                <th style="padding: 8px; width: 40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="color-list-body"></tbody>
                    </table>
                    <button type="button" id="add-color-btn" class="btn btn-secondary btn-sm" style="margin-top: 10px;">+ Adicionar Cor</button>
                </div>
            </div>
        `;

        const renderRows = () => {
            const tbody = container.querySelector('#color-list-body');
            tbody.innerHTML = '';
            
            state.colors.forEach((c, i) => {
                const rgb = hexToRgb(c.hex);
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #e2e8f0';
                row.className = 'color-row-item';
                row.dataset.index = i;
                
                row.innerHTML = `
                    <td style="padding: 5px; cursor: grab; color: #cbd5e1;" class="drag-handle">☰</td>
                    <td style="padding: 5px;">
                        <input type="text" class="color-hex form-control" value="${c.hex}" style="font-family: monospace; font-size: 12px; text-transform: uppercase;">
                    </td>
                    <td style="padding: 5px;">
                        <div style="display: flex; gap: 4px;">
                            <input type="number" class="rgb-r" value="${rgb.r}" min="0" max="255" style="width: 45px; font-size: 11px; padding: 2px;">
                            <input type="number" class="rgb-g" value="${rgb.g}" min="0" max="255" style="width: 45px; font-size: 11px; padding: 2px;">
                            <input type="number" class="rgb-b" value="${rgb.b}" min="0" max="255" style="width: 45px; font-size: 11px; padding: 2px;">
                        </div>
                    </td>
                    <td style="padding: 5px; text-align: center;">
                        <input type="color" class="color-picker" value="${c.hex}" style="width: 30px; height: 30px; padding: 0; border: none; cursor: pointer; border-radius: 4px;">
                    </td>
                    <td style="padding: 5px;">
                        <input type="text" class="color-label form-control" value="${c.label || ''}" placeholder="Ex: Principal">
                    </td>
                    <td style="padding: 5px; text-align: right;">
                        <button type="button" class="remove-color-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px;">&times;</button>
                    </td>
                `;

                const hexInput = row.querySelector('.color-hex');
                const rInput = row.querySelector('.rgb-r');
                const gInput = row.querySelector('.rgb-g');
                const bInput = row.querySelector('.rgb-b');
                const picker = row.querySelector('.color-picker');
                const labelInput = row.querySelector('.color-label');

                const updateFromHex = (newHex) => {
                    if (!/^#[0-9A-F]{6}$/i.test(newHex)) return;
                    state.colors[i].hex = newHex.toUpperCase();
                    const newRgb = hexToRgb(newHex);
                    rInput.value = newRgb.r;
                    gInput.value = newRgb.g;
                    bInput.value = newRgb.b;
                    picker.value = newHex;
                };

                const updateFromRgb = () => {
                    const newHex = rgbToHex(parseInt(rInput.value), parseInt(gInput.value), parseInt(bInput.value));
                    state.colors[i].hex = newHex;
                    hexInput.value = newHex;
                    picker.value = newHex;
                };

                hexInput.onchange = (e) => updateFromHex(e.target.value);
                rInput.onchange = gInput.onchange = bInput.onchange = updateFromRgb;
                picker.oninput = (e) => {
                    const newHex = e.target.value.toUpperCase();
                    state.colors[i].hex = newHex;
                    hexInput.value = newHex;
                    const newRgb = hexToRgb(newHex);
                    rInput.value = newRgb.r;
                    gInput.value = newRgb.g;
                    bInput.value = newRgb.b;
                };
                labelInput.onchange = (e) => state.colors[i].label = e.target.value;
                
                row.querySelector('.remove-color-btn').onclick = () => {
                    state.colors.splice(i, 1);
                    renderRows();
                };

                tbody.appendChild(row);
            });

            // Initialize Sortable if available
            if (window.Sortable) {
                new Sortable(tbody, {
                    handle: '.drag-handle',
                    animation: 150,
                    onEnd: (evt) => {
                        const movedItem = state.colors.splice(evt.oldIndex, 1)[0];
                        state.colors.splice(evt.newIndex, 0, movedItem);
                    }
                });
            }
        };

        container.querySelector('#add-color-btn').onclick = () => {
            state.colors.push({ hex: '#CCCCCC', label: '' });
            renderRows();
        };

        renderRows();
    }

    function read(container) {
        return {
            mapping: {},
            styling: {
                colors: state.colors
            },
            actions: {}
        };
    }

    return { render, read };
})();
window.ColorOptionsConfigEditor = ColorOptionsConfigEditor;
