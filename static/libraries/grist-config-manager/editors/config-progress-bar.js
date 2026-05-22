// libraries/grist-config-manager/editors/config-progress-bar.js

export const ProgressBarConfigEditor = (() => {
    let state = {};

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        const styling = config.styling || config || {};
        
        state = {
            min: styling.min !== undefined ? styling.min : 0,
            max: styling.max !== undefined ? styling.max : 100,
            progressType: styling.progressType || 'linear',
            labelPosition: styling.labelPosition || 'middle',
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
            ],
            // Internal Bar
            showInternalBar: styling.showInternalBar || false,
            internalBarColId: styling.internalBarColId || '',
            internalMainColor: styling.internalMainColor || '#2196f3',
            internalColorMode: styling.internalColorMode || 'solid',
            internalColorPaletteId: styling.internalColorPaletteId || '',
            internalColorStops: styling.internalColorStops || [
                { value: 0, color: '#90caf9' },
                { value: 100, color: '#1565c0' }
            ],
            internalLabelPosition: styling.internalLabelPosition || 'middle'
        };

        // Fetch numeric columns for internal bar selection
        let numericColumns = [];
        if (tableLens) {
            tableLens.getTableSchema(tableId).then(schema => {
                numericColumns = Object.values(schema).filter(col => ['Numeric', 'Int', 'Any'].includes(col.type));
                const select = container.querySelector('#pb-internal-col');
                if (select) {
                    select.innerHTML = '<option value="">-- Selecionar Coluna --</option>' + 
                        numericColumns.map(col => `<option value="${col.colId}" ${state.internalBarColId === col.colId ? 'selected' : ''}>${col.label}</option>`).join('');
                }
            });
        }

        container.innerHTML = `
            <div class="config-section">
                <h3>Estilo da Barra de Progresso (Global)</h3>
                
                <div class="form-group">
                    <label>Tipo de Progresso:</label>
                    <select id="pb-type" class="form-control">
                        <option value="linear" ${state.progressType === 'linear' ? 'selected' : ''}>Linear (Barra)</option>
                        <option value="circular" ${state.progressType === 'circular' ? 'selected' : ''}>Circular</option>
                    </select>
                </div>

                <div id="linear-options" style="display: ${state.progressType === 'linear' ? 'block' : 'none'}">
                    <div class="form-group">
                        <label>Arredondamento (px):</label>
                        <input type="number" id="pb-radius" class="form-control" value="${state.borderRadius}" min="0">
                    </div>
                </div>

                <div id="circular-options" style="display: ${state.progressType === 'circular' ? 'block' : 'none'}">
                    <div class="form-group">
                        <label>Posição do Valor:</label>
                        <select id="pb-label-pos" class="form-control">
                            <option value="middle" ${state.labelPosition === 'middle' ? 'selected' : ''}>No Centro</option>
                            <option value="above" ${state.labelPosition === 'above' ? 'selected' : ''}>Acima</option>
                            <option value="left" ${state.labelPosition === 'left' ? 'selected' : ''}>À Esquerda</option>
                            <option value="right" ${state.labelPosition === 'right' ? 'selected' : ''}>À Direita</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-top: 10px; padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px;">
                        <label style="cursor:pointer; font-weight: bold;">
                            <input type="checkbox" id="pb-show-internal" ${state.showInternalBar ? 'checked' : ''}> 
                            Adicionar Segunda Barra Circular (Interna)
                        </label>
                        <div id="internal-bar-config" style="display: ${state.showInternalBar ? 'block' : 'none'}; margin-top: 10px;">
                            <label style="font-size: 11px;">Coluna para Barra Interna:</label>
                            <select id="pb-internal-col" class="form-control form-control-sm">
                                <option value="">Carregando colunas...</option>
                            </select>
                        </div>
                    </div>
                </div>

                <hr>

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

                <div class="tabs-container" style="margin-top: 15px;">
                    <div style="display: flex; border-bottom: 1px solid #dee2e6; margin-bottom: 15px;">
                        <button type="button" class="tab-btn active" data-tab="primary" style="padding: 8px 16px; border: none; background: none; cursor: pointer; border-bottom: 2px solid #4caf50;">Barra Principal</button>
                        <button type="button" class="tab-btn" id="tab-btn-internal" data-tab="internal" style="display: ${state.showInternalBar ? 'block' : 'none'}; padding: 8px 16px; border: none; background: none; cursor: pointer;">Barra Interna</button>
                    </div>

                    <div id="tab-primary" class="tab-content">
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

                        <div class="form-group" style="display: flex; gap: 20px;">
                            <label style="cursor:pointer"><input type="checkbox" id="pb-striped" ${state.striped ? 'checked' : ''}> Listrado</label>
                            <label style="cursor:pointer"><input type="checkbox" id="pb-animated" ${state.animated ? 'checked' : ''}> Animado</label>
                        </div>

                        <div class="form-group">
                            <label>Modo de Cores:</label>
                            <select id="pb-color-mode" class="form-control">
                                <option value="solid-fixed" ${state.colorMode === 'solid-fixed' || state.colorMode === 'solid' ? 'selected' : ''}>Sólida Estática (Cor única fixa)</option>
                                <option value="solid-dynamic" ${state.colorMode === 'solid-dynamic' || state.colorMode === 'dynamic' || state.colorMode === 'dynamic-gradient' ? 'selected' : ''}>Sólida Dinâmica (Muda tom com %)</option>
                                <option value="solid-thresholds" ${state.colorMode === 'solid-thresholds' ? 'selected' : ''}>Sólida por Degraus (Abrupto)</option>
                                <option value="gradient-smooth" ${state.colorMode === 'gradient-smooth' || state.colorMode === 'smooth' || state.colorMode === 'static-gradient' || state.colorMode === 'gradient' ? 'selected' : ''}>Gradiente Suave (Multi-cor)</option>
                                <option value="gradient-steps" ${state.colorMode === 'gradient-steps' || state.colorMode === 'stepped' || state.colorMode === 'steps' ? 'selected' : ''}>Gradiente em Blocos (Multi-cor)</option>
                            </select>
                            <div id="pb-color-mode-desc" style="font-size: 11px; color: #666; margin-top: 5px; font-style: italic;">
                                <!-- Descrição dinâmica injetada via JS -->
                            </div>
                        </div>

                        <div id="color-stops-container" style="display: ${state.colorMode !== 'solid' ? 'block' : 'none'}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h4 style="margin:0">Cores / Gradiente</h4>
                                <select id="pb-color-palette-id" class="form-control form-control-sm" style="width: 150px; font-size: 11px;">
                                    <option value="">-- Manual --</option>
                                    ${receivedConfigs.filter(c => c.componentType === 'Color Options').map(c => `<option value="${c.configId}" ${state.colorPaletteId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div id="color-stops-list-wrapper" style="display: ${state.colorPaletteId ? 'none' : 'block'}">
                                <div id="color-stops-list"></div>
                                <button type="button" id="add-stop-btn" class="btn btn-secondary btn-sm" style="margin-top:10px;">+ Adicionar Faixa</button>
                            </div>
                        </div>
                    </div>

                    <div id="tab-internal" class="tab-content" style="display: none;">
                        <div class="form-group">
                            <label>Cor Principal (Barra Interna):</label>
                            <input type="color" id="pb-internal-main-color" class="form-control" value="${state.internalMainColor}">
                        </div>

                        <div class="form-group">
                            <label>Posição do Valor (Interna):</label>
                            <select id="pb-internal-label-pos" class="form-control">
                                <option value="middle" ${state.internalLabelPosition === 'middle' ? 'selected' : ''}>No Centro</option>
                                <option value="above" ${state.internalLabelPosition === 'above' ? 'selected' : ''}>Acima</option>
                                <option value="left" ${state.internalLabelPosition === 'left' ? 'selected' : ''}>À Esquerda</option>
                                <option value="right" ${state.internalLabelPosition === 'right' ? 'selected' : ''}>À Direita</option>
                                <option value="none" ${state.internalLabelPosition === 'none' ? 'selected' : ''}>Ocultar</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Modo de Cores (Interna):</label>
                            <select id="pb-internal-color-mode" class="form-control">
                                <option value="solid" ${state.internalColorMode === 'solid' ? 'selected' : ''}>Cor Sólida Única</option>
                                <option value="dynamic-gradient" ${state.internalColorMode === 'dynamic-gradient' ? 'selected' : ''}>Gradiente Dinâmico</option>
                                <option value="steps" ${state.internalColorMode === 'steps' ? 'selected' : ''}>Degraus</option>
                            </select>
                        </div>

                        <div id="internal-color-stops-container" style="display: ${state.internalColorMode !== 'solid' ? 'block' : 'none'}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h4 style="margin:0">Cores / Gradiente (Interna)</h4>
                                <select id="pb-internal-color-palette-id" class="form-control form-control-sm" style="width: 150px; font-size: 11px;">
                                    <option value="">-- Manual --</option>
                                    ${receivedConfigs.filter(c => c.componentType === 'Color Options').map(c => `<option value="${c.configId}" ${state.internalColorPaletteId === c.configId ? 'selected' : ''}>${c.widgetTitle}</option>`).join('')}
                                </select>
                            </div>
                            <div id="internal-color-stops-list-wrapper" style="display: ${state.internalColorPaletteId ? 'none' : 'block'}">
                                <div id="internal-color-stops-list"></div>
                                <button type="button" id="add-internal-stop-btn" class="btn btn-secondary btn-sm" style="margin-top:10px;">+ Adicionar Faixa</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const renderStops = (isInternal = false) => {
            const listId = isInternal ? '#internal-color-stops-list' : '#color-stops-list';
            const stops = isInternal ? state.internalColorStops : state.colorStops;
            const list = container.querySelector(listId);
            if (!list) return;

            list.innerHTML = stops.map((stop, i) => `
                <div class="stop-row" style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                    <div style="flex: 1">
                        <label style="font-size: 11px;">%:</label>
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
                input.onchange = (e) => { stops[e.target.dataset.index].value = Number(e.target.value); };
            });
            list.querySelectorAll('.stop-color').forEach(input => {
                input.onchange = (e) => { stops[e.target.dataset.index].color = e.target.value; };
            });
            list.querySelectorAll('.remove-stop-btn').forEach(btn => {
                btn.onclick = (e) => {
                    stops.splice(e.target.dataset.index, 1);
                    renderStops(isInternal);
                };
            });
        };

        // Tab Switching Logic
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.borderBottom = 'none';
                });
                container.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                btn.classList.add('active');
                btn.style.borderBottom = '2px solid #4caf50';
                container.querySelector(`#tab-${btn.dataset.tab}`).style.display = 'block';
            };
        });

        // Toggle Linear/Circular
        const typeSelect = container.querySelector('#pb-type');
        typeSelect.onchange = () => {
            state.progressType = typeSelect.value;
            container.querySelector('#linear-options').style.display = state.progressType === 'linear' ? 'block' : 'none';
            container.querySelector('#circular-options').style.display = state.progressType === 'circular' ? 'block' : 'none';
        };

        // Toggle Internal Bar
        const internalCheck = container.querySelector('#pb-show-internal');
        internalCheck.onchange = () => {
            state.showInternalBar = internalCheck.checked;
            container.querySelector('#internal-bar-config').style.display = state.showInternalBar ? 'block' : 'none';
            container.querySelector('#tab-btn-internal').style.display = state.showInternalBar ? 'block' : 'none';
        };

        // Sync state for selects
        container.querySelector('#pb-internal-col').onchange = (e) => { state.internalBarColId = e.target.value; };
        container.querySelector('#pb-label-pos').onchange = (e) => { state.labelPosition = e.target.value; };
        container.querySelector('#pb-internal-label-pos').onchange = (e) => { state.internalLabelPosition = e.target.value; };

        const updateDescriptions = () => {
            const mode = container.querySelector('#pb-color-mode').value;
            const descEl = container.querySelector('#pb-color-mode-desc');
            const descs = {
                'solid-fixed': 'Barra com uma única cor fixa institucional.',
                'solid-dynamic': 'A barra toda muda de cor baseada na interpolação exata do valor atual.',
                'solid-thresholds': 'A barra toda muda de cor abruptamente ao cruzar os limites dos quadrantes.',
                'gradient-smooth': 'Transição suave e contínua entre as cores de ponta a ponta.',
                'gradient-steps': 'Cores divididas em blocos fixos com transições secas (sem degradê).'
            };
            descEl.textContent = descs[mode] || '';
            
            // Also update internal mode select to match primary modes for consistency
            const internalModeSelect = container.querySelector('#pb-internal-color-mode');
            if (internalModeSelect) {
                 internalModeSelect.innerHTML = `
                    <option value="solid-fixed" ${state.internalColorMode === 'solid-fixed' || state.internalColorMode === 'solid' ? 'selected' : ''}>Sólida Estática</option>
                    <option value="solid-dynamic" ${state.internalColorMode === 'solid-dynamic' || state.internalColorMode === 'dynamic' || state.internalColorMode === 'dynamic-gradient' ? 'selected' : ''}>Sólida Dinâmica</option>
                    <option value="solid-thresholds" ${state.internalColorMode === 'solid-thresholds' ? 'selected' : ''}>Sólida por Degraus</option>
                    <option value="gradient-smooth" ${state.internalColorMode === 'gradient-smooth' || state.internalColorMode === 'smooth' || state.internalColorMode === 'static-gradient' || state.internalColorMode === 'gradient' ? 'selected' : ''}>Gradiente Suave</option>
                    <option value="gradient-steps" ${state.internalColorMode === 'gradient-steps' || state.internalColorMode === 'stepped' || state.internalColorMode === 'steps' ? 'selected' : ''}>Gradiente em Blocos</option>
                 `;
            }
        };

        // Main Color Mode
        const colorModeSelect = container.querySelector('#pb-color-mode');
        colorModeSelect.onchange = () => {
            container.querySelector('#color-stops-container').style.display = colorModeSelect.value !== 'solid' ? 'block' : 'none';
            updateDescriptions();
        };
        updateDescriptions();

        // Internal Color Mode
        const internalColorModeSelect = container.querySelector('#pb-internal-color-mode');
        internalColorModeSelect.onchange = () => {
            container.querySelector('#internal-color-stops-container').style.display = internalColorModeSelect.value !== 'solid' ? 'block' : 'none';
        };

        container.querySelector('#add-stop-btn').onclick = () => {
            state.colorStops.push({ value: 100, color: '#4caf50' });
            renderStops(false);
        };

        container.querySelector('#add-internal-stop-btn').onclick = () => {
            state.internalColorStops.push({ value: 100, color: '#2196f3' });
            renderStops(true);
        };

        renderStops(false);
        renderStops(true);
    }

    function read(container) {
        const colorStops = [];
        container.querySelectorAll('#color-stops-list .stop-row').forEach(row => {
            colorStops.push({
                value: Number(row.querySelector('.stop-val').value),
                color: row.querySelector('.stop-color').value
            });
        });

        const internalColorStops = [];
        container.querySelectorAll('#internal-color-stops-list .stop-row').forEach(row => {
            internalColorStops.push({
                value: Number(row.querySelector('.stop-val').value),
                color: row.querySelector('.stop-color').value
            });
        });

        return {
            mapping: {},
            styling: {
                progressType: container.querySelector('#pb-type').value,
                labelPosition: container.querySelector('#pb-label-pos').value,
                min: Number(container.querySelector('#pb-min').value),
                max: Number(container.querySelector('#pb-max').value),
                mainColor: container.querySelector('#pb-main-color').value,
                bgColor: container.querySelector('#pb-bg-color').value,
                borderRadius: container.querySelector('#pb-radius') ? Number(container.querySelector('#pb-radius').value) : 4,
                thickness: container.querySelector('#pb-thickness').value,
                striped: container.querySelector('#pb-striped').checked,
                animated: container.querySelector('#pb-animated').checked,
                colorMode: container.querySelector('#pb-color-mode').value,
                colorPaletteId: container.querySelector('#pb-color-palette-id').value,
                colorStops: colorStops,
                // Internal
                showInternalBar: container.querySelector('#pb-show-internal').checked,
                internalBarColId: container.querySelector('#pb-internal-col').value,
                internalMainColor: container.querySelector('#pb-internal-main-color').value,
                internalLabelPosition: container.querySelector('#pb-internal-label-pos').value,
                internalColorMode: container.querySelector('#pb-internal-color-mode').value,
                internalColorPaletteId: container.querySelector('#pb-internal-color-palette-id').value,
                internalColorStops: internalColorStops
            },
            actions: {}
        };
    }


    return { render, read };
})();
window.ProgressBarConfigEditor = ProgressBarConfigEditor;
