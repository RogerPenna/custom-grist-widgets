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
            deadlineDayField: mapping.deadlineDayField || '', // NEW

            // Goal Limits
            useUpperLimitField: mapping.useUpperLimitField || '',
            useLowerLimitField: mapping.useLowerLimitField || '',
            lowerLimitValueField: mapping.lowerLimitValueField || '',
            upperLimitValueField: mapping.upperLimitValueField || '',
            
            // Delay Thresholds
            warningDaysThreshold: mapping.warningDaysThreshold !== undefined ? mapping.warningDaysThreshold : 1, // NEW
            criticalDaysThreshold: mapping.criticalDaysThreshold !== undefined ? mapping.criticalDaysThreshold : 30, // NEW

            // Value Mappings
            directionMap: mapping.directionMap || {}, 
            consolidationMap: mapping.consolidationMap || {},
            periodicityMap: mapping.periodicityMap || {},

            // Grouping
            groupFields: mapping.groupFields || [],
            groupDisplayFields: mapping.groupDisplayFields || {},

            // Styling
            cardType: styling.cardType || 'STANDARD',
            cardConfigId: styling.cardConfigId || '',
            yearsCount: styling.yearsCount !== undefined ? styling.yearsCount : 3,
            progressBarPreset: styling.progressBarPreset || '',

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
                    <button type="button" class="config-tab-button" data-tab-id="grouping">Agrupamento</button>
                    <button type="button" class="config-tab-button" data-tab-id="styling">Estilo</button>
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
                        <div class="form-group">
                            <label>Dia Vencimento Fixo (Coluna num):</label>
                            <select id="ind-deadline-day-field" class="form-control">${createColumnOptions(columns, state.deadlineDayField)}</select>
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
                        <hr>
                        <h4>Limites da Meta (% da Meta)</h4>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                            <div class="form-group">
                                <label>Ativar Limite Superior:</label>
                                <select id="ind-use-upper-limit-field" class="form-control">${createColumnOptions(columns, state.useUpperLimitField)}</select>
                            </div>
                            <div class="form-group">
                                <label>Valor % Superior:</label>
                                <select id="ind-upper-limit-value-field" class="form-control">${createColumnOptions(columns, state.upperLimitValueField)}</select>
                            </div>
                            <div class="form-group">
                                <label>Ativar Limite Inferior:</label>
                                <select id="ind-use-lower-limit-field" class="form-control">${createColumnOptions(columns, state.useLowerLimitField)}</select>
                            </div>
                            <div class="form-group">
                                <label>Valor % Inferior:</label>
                                <select id="ind-lower-limit-value-field" class="form-control">${createColumnOptions(columns, state.lowerLimitValueField)}</select>
                            </div>
                        </div>
                    </div>

                    <div data-tab-section="logic" style="display:none">
                        <h3>Mapeamento de Valores Reais & Alertas</h3>
                        <p class="help-text">Mapeie os valores da sua coluna Grist para a lógica do App.</p>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom: 20px; padding: 15px; background: #fff8e6; border: 1px solid #ffeeba; border-radius: 6px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Dias de Atraso para 🟡 Amarelo:</label>
                                <input type="number" id="ind-warning-days" class="form-control" value="${state.warningDaysThreshold}" min="0">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Dias de Atraso para 🔴 Vermelho:</label>
                                <input type="number" id="ind-critical-days" class="form-control" value="${state.criticalDaysThreshold}" min="1">
                            </div>
                        </div>

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
                            <p class="help-text">Define como os valores mensais são agrupados para o cálculo anual (Soma, Média ou o valor mais recente).</p>
                            <div id="cons-val-map-list"></div>
                        </div>
                    </div>

                    <div data-tab-section="grouping" style="display:none">
                        <h3>Opções de Agrupamento</h3>
                        <p class="help-text">Selecione as colunas que estarão disponíveis para agrupar os indicadores no widget.</p>
                        <div id="ind-group-fields-list" style="max-height: 250px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #fff;">
                            ${columns.map(c => `
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                    <input type="checkbox" id="grp-${c}" value="${c}" ${state.groupFields.includes(c) ? 'checked' : ''}>
                                    <label for="grp-${c}" style="margin:0; cursor:pointer;">${c}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div data-tab-section="styling" style="display:none">
                        <h3>Configuração Visual</h3>
                        <div class="form-group">
                            <label>Tipo de Card (Lateral Esquerda):</label>
                            <select id="ind-card-type" class="form-control">
                                <option value="STANDARD" ${state.cardType === 'STANDARD' ? 'selected' : ''}>Padrão (Fixo)</option>
                                <option value="CUSTOM" ${state.cardType === 'CUSTOM' ? 'selected' : ''}>Personalizado (Card System)</option>
                            </select>
                        </div>
                        <div class="form-group" id="ind-card-config-container" style="display: ${state.cardType === 'CUSTOM' ? 'block' : 'none'}">
                            <label>Configuração de Card (Card System):</label>
                            <select id="ind-card-config-id" class="form-control">
                                <option value="">-- Selecione uma Configuração --</option>
                                ${state.receivedConfigs.filter(c => c.componentType === 'Card System').map(c => 
                                    `<option value="${c.configId}" ${c.configId === state.cardConfigId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Quantidade de Anos Anteriores (Grid Direita):</label>
                            <input type="number" id="ind-years-count" class="form-control" value="${state.yearsCount}" min="0" max="10">
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

            // Toggle custom card selector
            const cardTypeSelect = container.querySelector('#ind-card-type');
            const cardConfigContainer = container.querySelector('#ind-card-config-container');
            cardTypeSelect.onchange = () => {
                cardConfigContainer.style.display = cardTypeSelect.value === 'CUSTOM' ? 'block' : 'none';
            };

            // Trigger debug update on any change
            container.querySelectorAll('input, select, textarea').forEach(el => {
                el.addEventListener('change', () => {
                    const event = new CustomEvent('cm-editor-change', { bubbles: true });
                    container.dispatchEvent(event);
                });
            });
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
                <div class="mapping-row" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                    <span style="flex:1; font-weight:bold;">${opt}</span>
                    <select class="cons-map-input" data-value="${opt}" style="flex:1.5; padding:5px;">
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

        const groupFields = [];
        container.querySelectorAll('#ind-group-fields-list input:checked').forEach(cb => {
            groupFields.push(cb.value);
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
            useUpperLimitField: container.querySelector('#ind-use-upper-limit-field').value,
            upperLimitValueField: container.querySelector('#ind-upper-limit-value-field').value,
            useLowerLimitField: container.querySelector('#ind-use-lower-limit-field').value,
            lowerLimitValueField: container.querySelector('#ind-lower-limit-value-field').value,
            deadlineDayField: container.querySelector('#ind-deadline-day-field').value,
            warningDaysThreshold: parseInt(container.querySelector('#ind-warning-days').value, 10),
            criticalDaysThreshold: parseInt(container.querySelector('#ind-critical-days').value, 10),
            directionMap: dirMap,
            consolidationMap: consMap,
            periodicityMap: perMap,
            groupFields: groupFields
        };

        const styling = {
            cardType: container.querySelector('#ind-card-type').value,
            cardConfigId: container.querySelector('#ind-card-config-id').value,
            yearsCount: parseInt(container.querySelector('#ind-years-count').value, 10)
        };
        const actions = {
            drawerConfigId: container.querySelector('#ind-drawer-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();
window.IndicatorsConfigEditor = IndicatorsConfigEditor;
