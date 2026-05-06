// libraries/grist-config-manager/editors/config-indicators.js

export const IndicatorsConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _targetTableId = null;

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        _targetTableId = tableId;
        const options = config || {};
        
        const mapping = options.mapping || options || {};
        const styling = options.styling || options || {};
        const actions = options.actions || options || {};

        state = {
            // Mapping
            resultsField: mapping.resultsField || '',
            directionField: mapping.directionField || '',
            consolidationField: mapping.consolidationField || '',
            periodicityField: mapping.periodicityField || '',
            targetField: mapping.targetField || '',
            chartMinField: mapping.chartMinField || '',
            chartMaxField: mapping.chartMaxField || '',
            staticAchievementField: mapping.staticAchievementField || '',
            staticStatusField: mapping.staticStatusField || '',
            staticConsolidatedValueField: mapping.staticConsolidatedValueField || '',
            
            // Value Mappings
            directionMap: mapping.directionMap || {}, 
            consolidationMap: mapping.consolidationMap || {},
            periodicityMap: mapping.periodicityMap || {},

            // Actions
            drawerConfigId: actions.drawerConfigId || null,
            
            receivedConfigs: receivedConfigs
        };

        tableLens.getTableSchema(tableId).then(schema => {
            const columns = Object.keys(schema);
            container.innerHTML = `
                <div class="config-tabs">
                    <button type="button" class="config-tab-button active" data-tab-id="mapping">Mapeamento</button>
                    <button type="button" class="config-tab-button" data-tab-id="logic">Lógica & Valores</button>
                    <button type="button" class="config-tab-button" data-tab-id="actions">Ações</button>
                </div>
                <div class="config-content">
                    <div data-tab-section="mapping">
                        <h3>Mapeamento de Colunas</h3>
                        <div class="form-group">
                            <label>Dados do Indicador (Master JSON):</label>
                            <select id="ind-results-field" class="form-control">${createColumnOptions(columns, state.resultsField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Meta do Ciclo (Campo Backup):</label>
                            <select id="ind-target-field" class="form-control">${createColumnOptions(columns, state.targetField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Direção (Coluna):</label>
                            <select id="ind-direction-field" class="form-control">${createColumnOptions(columns, state.directionField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Periodicidade (Coluna):</label>
                            <select id="ind-periodicity-field" class="form-control">${createColumnOptions(columns, state.periodicityField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Tipo Consolidação (Coluna):</label>
                            <select id="ind-consolidation-field" class="form-control">${createColumnOptions(columns, state.consolidationField)}</select>
                        </div>
                        <hr>
                        <h4>Persistência Estática (Salvar de volta no Grist)</h4>
                        <div class="form-group">
                            <label>Valor Consolidado (SinalResult):</label>
                            <select id="ind-static-consolidated-field" class="form-control">${createColumnOptions(columns, state.staticConsolidatedValueField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Atingimento (Performance2):</label>
                            <select id="ind-static-achievement-field" class="form-control">${createColumnOptions(columns, state.staticAchievementField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Semáforo (Emoji):</label>
                            <select id="ind-static-status-field" class="form-control">${createColumnOptions(columns, state.staticStatusField)}</select>
                        </div>
                    </div>

                    <div data-tab-section="logic" style="display:none">
                        <h3>Mapeamento de Valores Reais</h3>
                        <p class="help-text">Mapeie os valores da sua coluna Grist para a lógica do App.</p>
                        
                        <div id="direction-mapping-container">
                            <h4>Direção do Indicador</h4>
                            <div id="dir-val-map-list"></div>
                        </div>

                        <div id="periodicity-mapping-container" style="margin-top:20px;">
                            <h4>Periodicidade</h4>
                            <div id="per-val-map-list"></div>
                        </div>

                        <div id="consolidation-mapping-container" style="margin-top:20px;">
                            <h4>Tipo de Consolidação</h4>
                            <div id="cons-val-map-list"></div>
                        </div>
                    </div>

                    <div data-tab-section="actions" style="display:none">
                        <h3>Configuração de Ações</h3>
                        <div class="form-group">
                            <label>Abrir Gaveta para Edição:</label>
                            <select id="ind-drawer-id" class="form-control">
                                <option value="">-- Nenhum --</option>
                                ${state.receivedConfigs.filter(c => c.componentType === 'Drawer').map(c => 
                                    `<option value="${c.configId}" ${c.configId === state.drawerConfigId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;

            setupTabNavigation(container);
            setupLogicMapping(container, schema);
        });
    }

    function setupTabNavigation(container) {
        container.querySelectorAll('.config-tab-button').forEach(btn => {
            btn.onclick = () => {
                container.querySelectorAll('.config-tab-button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                container.querySelectorAll('[data-tab-section]').forEach(s => s.style.display = 'none');
                container.querySelector(`[data-tab-section="${btn.dataset.tabId}"]`).style.display = 'block';
            };
        });
    }

    async function setupLogicMapping(container, schema) {
        const dirSelect = container.querySelector('#ind-direction-field');
        const consSelect = container.querySelector('#ind-consolidation-field');
        const perSelect = container.querySelector('#ind-periodicity-field');

        const updateDirectionMap = async () => {
            const colId = dirSelect.value;
            const listEl = container.querySelector('#dir-val-map-list');
            if (!colId) { listEl.innerHTML = '<p>Selecione uma coluna de direção primeiro.</p>'; return; }
            const options = await getFieldOptions(colId, schema);
            listEl.innerHTML = options.map(opt => `
                <div class="mapping-row" style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                    <span style="flex:1">${opt}</span>
                    <select class="dir-map-input" data-value="${opt}" style="flex:1">
                        <option value="MORE_IS_BETTER" ${state.directionMap[opt] === 'MORE_IS_BETTER' ? 'selected' : ''}>Maior é Melhor</option>
                        <option value="LESS_IS_BETTER" ${state.directionMap[opt] === 'LESS_IS_BETTER' ? 'selected' : ''}>Menor é Melhor</option>
                    </select>
                </div>
            `).join('');
        };

        const updateConsolidationMap = async () => {
            const colId = consSelect.value;
            const listEl = container.querySelector('#cons-val-map-list');
            if (!colId) { listEl.innerHTML = '<p>Selecione uma coluna de consolidação primeiro.</p>'; return; }
            const options = await getFieldOptions(colId, schema);
            listEl.innerHTML = options.map(opt => `
                <div class="mapping-row" style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                    <span style="flex:1">${opt}</span>
                    <select class="cons-map-input" data-value="${opt}" style="flex:1">
                        <option value="SUM" ${state.consolidationMap[opt] === 'SUM' ? 'selected' : ''}>Soma / Acumulado</option>
                        <option value="AVG" ${state.consolidationMap[opt] === 'AVG' ? 'selected' : ''}>Média</option>
                        <option value="LAST" ${state.consolidationMap[opt] === 'LAST' ? 'selected' : ''}>Último Valor</option>
                    </select>
                </div>
            `).join('');
        };

        const updatePeriodicityMap = async () => {
            const colId = perSelect.value;
            const listEl = container.querySelector('#per-val-map-list');
            if (!colId) { listEl.innerHTML = '<p>Selecione uma coluna de periodicidade primeiro.</p>'; return; }
            const options = await getFieldOptions(colId, schema);
            listEl.innerHTML = options.map(opt => `
                <div class="mapping-row" style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                    <span style="flex:1">${opt}</span>
                    <select class="per-map-input" data-value="${opt}" style="flex:1">
                        <option value="MONTHLY" ${state.periodicityMap[opt] === 'MONTHLY' ? 'selected' : ''}>Mensal</option>
                        <option value="BIMONTHLY" ${state.periodicityMap[opt] === 'BIMONTHLY' ? 'selected' : ''}>Bimestral</option>
                        <option value="QUARTERLY" ${state.periodicityMap[opt] === 'QUARTERLY' ? 'selected' : ''}>Trimestral</option>
                        <option value="QUADRIMESTRAL" ${state.periodicityMap[opt] === 'QUADRIMESTRAL' ? 'selected' : ''}>Quadrimestral</option>
                        <option value="SEMIANNUAL" ${state.periodicityMap[opt] === 'SEMIANNUAL' ? 'selected' : ''}>Semestral</option>
                        <option value="ANNUAL" ${state.periodicityMap[opt] === 'ANNUAL' ? 'selected' : ''}>Anual</option>
                    </select>
                </div>
            `).join('');
        };

        dirSelect.onchange = updateDirectionMap;
        consSelect.onchange = updateConsolidationMap;
        perSelect.onchange = updatePeriodicityMap;

        updateDirectionMap();
        updateConsolidationMap();
        updatePeriodicityMap();
    }

    async function getFieldOptions(colId, schema) {
        const col = schema[colId];
        if (!col) return [];
        if (col.type === 'Choice' || col.type === 'ChoiceList') {
            return col.widgetOptions?.choices || [];
        }
        if (col.type.startsWith('Ref:')) {
            return ["(Ref - Use colunas Choice para mapeamento fácil)"];
        }
        return ["(Coluna sem opções pré-definidas)"];
    }

    function createColumnOptions(columns, selected) {
        return `<option value="">-- Selecione --</option>` + 
            columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
    }

    function read(container) {
        const dirMap = {};
        container.querySelectorAll('.dir-map-input').forEach(sel => {
            dirMap[sel.dataset.value] = sel.value;
        });

        const consMap = {};
        container.querySelectorAll('.cons-map-input').forEach(sel => {
            consMap[sel.dataset.value] = sel.value;
        });

        const perMap = {};
        container.querySelectorAll('.per-map-input').forEach(sel => {
            perMap[sel.dataset.value] = sel.value;
        });

        const mapping = {
            tableId: _targetTableId,
            resultsField: container.querySelector('#ind-results-field').value,
            directionField: container.querySelector('#ind-direction-field').value,
            consolidationField: container.querySelector('#ind-consolidation-field').value,
            periodicityField: container.querySelector('#ind-periodicity-field').value,
            targetField: container.querySelector('#ind-target-field').value,
            staticConsolidatedValueField: container.querySelector('#ind-static-consolidated-field').value,
            staticAchievementField: container.querySelector('#ind-static-achievement-field').value,
            staticStatusField: container.querySelector('#ind-static-status-field').value,
            directionMap: dirMap,
            consolidationMap: consMap,
            periodicityMap: perMap
        };

        const styling = {};
        const actions = {
            drawerConfigId: container.querySelector('#ind-drawer-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();
