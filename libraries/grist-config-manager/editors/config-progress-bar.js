// libraries/grist-config-manager/editors/config-progress-bar.js

export const ProgressBarConfigEditor = (() => {
    let state = {};

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        const styling = config.styling || config || {};
        
        state = {
            min: styling.min !== undefined ? styling.min : 0,
            max: styling.max !== undefined ? styling.max : 100,
            mainColor: styling.mainColor || '#4caf50',
            bgColor: styling.bgColor || '#e0e0e0',
            borderRadius: styling.borderRadius !== undefined ? styling.borderRadius : 4,
            thickness: styling.thickness || '100',
            striped: styling.striped || false,
            animated: styling.animated || false,
            colorMode: styling.colorMode || 'solid',
            colorPaletteId: styling.colorPaletteId || '',
            colorStops: styling.colorStops || [
                { value: 0, color: '#ff4d4d' },
                { value: 100, color: '#4caf50' }
            ]
        };

        container.innerHTML = `
            <div class="config-section">
                <h3>Estilo da Barra de Progresso (Global)</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>Valor Mínimo:</label>
                        <input type="number" id="pb-min" class="form-control" value="${state.min}">
                    </div>
                    <div class="form-group">
                        <label>Valor Máximo:</label>
                        <input type="number" id="pb-max" class="form-control" value="${state.max}">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>Cor Principal (Solid):</label>
                        <input type="color" id="pb-main-color" class="form-control" value="${state.mainColor}">
                    </div>
                    <div class="form-group">
                        <label>Cor de Fundo:</label>
                        <input type="color" id="pb-bg-color" class="form-control" value="${state.bgColor}">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>Arredondamento (px):</label>
                        <input type="number" id="pb-radius" class="form-control" value="${state.borderRadius}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Espessura (%):</label>
                        <select id="pb-thickness" class="form-control">
                            <option value="50" ${state.thickness == '50' ? 'selected' : ''}>Muito Fina (50%)</option>
                            <option value="75" ${state.thickness == '75' ? 'selected' : ''}>Fina (75%)</option>
                            <option value="100" ${state.thickness == '100' ? 'selected' : ''}>Padrão (100%)</option>
                            <option value="150" ${state.thickness == '150' ? 'selected' : ''}>Grossa (150%)</option>
                            <option value="200" ${state.thickness == '200' ? 'selected' : ''}>Extra Grossa (200%)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="display: flex; gap: 20px;">
                    <label style="cursor:pointer"><input type="checkbox" id="pb-striped" ${state.striped ? 'checked' : ''}> Listrado (Striped)</label>
                    <label style="cursor:pointer"><input type="checkbox" id="pb-animated" ${state.animated ? 'checked' : ''}> Animado (Pulse)</label>
                </div>

                <hr>

                <div class="form-group">
                    <label>Modo de Cores:</label>
                    <select id="pb-color-mode" class="form-control">
                        <option value="solid" ${state.colorMode === 'solid' ? 'selected' : ''}>Cor Sólida Única</option>
                        <option value="dynamic-gradient" ${state.colorMode === 'dynamic-gradient' ? 'selected' : ''}>Gradiente Dinâmico (Muda cor conforme valor)</option>
                        <option value="static-gradient" ${state.colorMode === 'static-gradient' ? 'selected' : ''}>Gradiente Estático (Barra colorida inteira)</option>
                        <option value="steps" ${state.colorMode === 'steps' ? 'selected' : ''}>Degraus (Cores fixas por faixas)</option>
                    </select>
                </div>

                <div id="color-stops-container" style="display: ${state.colorMode !== 'solid' ? 'block' : 'none'}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin:0">Faixas de Cores / Gradiente</h4>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <label style="font-size: 11px; white-space: nowrap;">Vincular Paleta Dinâmica:</label>
                            <select id="pb-color-palette-id" class="form-control form-control-sm" style="width: 150px; font-size: 11px;">
                                <option value="">-- Manual (Cores Fixas) --</option>
                                ${receivedConfigs.filter(c => c.componentType === 'Color Options').map(c => `<option value="${c.configId}" ${state.colorPaletteId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="color-stops-list-wrapper" style="display: ${state.colorPaletteId ? 'none' : 'block'}">
                        <div id="color-stops-list"></div>
                        <button type="button" id="add-stop-btn" class="btn btn-secondary btn-sm" style="margin-top:10px;">+ Adicionar Faixa</button>
                    </div>
                    <div id="palette-linked-notice" style="display: ${state.colorPaletteId ? 'block' : 'none'}; padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 11px; color: #166534;">
                        ✓ As cores estão vinculadas à paleta selecionada e serão atualizadas automaticamente.
                    </div>
                </div>
            </div>
        `;

        const renderStops = () => {
            const list = container.querySelector('#color-stops-list');
            if (!list) return;
            list.innerHTML = state.colorStops.map((stop, i) => `
                <div class="stop-row" style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                    <div style="flex: 1">
                        <label style="font-size: 11px;">Valor %:</label>
                        <input type="number" class="stop-val form-control" data-index="${i}" value="${stop.value}" min="0" max="100">
                    </div>
                    <div style="flex: 1">
                        <label style="font-size: 11px;">Cor:</label>
                        <input type="color" class="stop-color form-control" data-index="${i}" value="${stop.color}">
                    </div>
                    <button type="button" class="remove-stop-btn btn btn-danger btn-sm" data-index="${i}" style="margin-top: 18px;">&times;</button>
                </div>
            `).join('');

            list.querySelectorAll('.stop-val').forEach(input => {
                input.onchange = (e) => {
                    state.colorStops[e.target.dataset.index].value = Number(e.target.value);
                };
            });
            list.querySelectorAll('.stop-color').forEach(input => {
                input.onchange = (e) => {
                    state.colorStops[e.target.dataset.index].color = e.target.value;
                };
            });
            list.querySelectorAll('.remove-stop-btn').forEach(btn => {
                btn.onclick = (e) => {
                    state.colorStops.splice(e.target.dataset.index, 1);
                    renderStops();
                };
            });
        };

        const colorModeSelect = container.querySelector('#pb-color-mode');
        const stopsContainer = container.querySelector('#color-stops-container');
        colorModeSelect.onchange = () => {
            stopsContainer.style.display = colorModeSelect.value !== 'solid' ? 'block' : 'none';
        };

        const paletteSelect = container.querySelector('#pb-color-palette-id');
        const stopsWrapper = container.querySelector('#color-stops-list-wrapper');
        const paletteNotice = container.querySelector('#palette-linked-notice');

        paletteSelect.onchange = (e) => {
            state.colorPaletteId = e.target.value;
            stopsWrapper.style.display = state.colorPaletteId ? 'none' : 'block';
            paletteNotice.style.display = state.colorPaletteId ? 'block' : 'none';
        };

        container.querySelector('#add-stop-btn').onclick = () => {
            state.colorStops.push({ value: 100, color: '#4caf50' });
            renderStops();
        };

        renderStops();
    }

    function read(container) {
        const colorStops = [];
        container.querySelectorAll('.stop-row').forEach(row => {
            colorStops.push({
                value: Number(row.querySelector('.stop-val').value),
                color: row.querySelector('.stop-color').value
            });
        });

        return {
            mapping: {}, // No mapping for global presets
            styling: {
                min: Number(container.querySelector('#pb-min').value),
                max: Number(container.querySelector('#pb-max').value),
                mainColor: container.querySelector('#pb-main-color').value,
                bgColor: container.querySelector('#pb-bg-color').value,
                borderRadius: Number(container.querySelector('#pb-radius').value),
                thickness: container.querySelector('#pb-thickness').value,
                striped: container.querySelector('#pb-striped').checked,
                animated: container.querySelector('#pb-animated').checked,
                colorMode: container.querySelector('#pb-color-mode').value,
                colorPaletteId: container.querySelector('#pb-color-palette-id').value,
                colorStops: colorStops
            },
            actions: {}
        };
    }

    return { render, read };
})();
window.ProgressBarConfigEditor = ProgressBarConfigEditor;
