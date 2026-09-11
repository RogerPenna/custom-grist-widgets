// libraries/grist-config-manager/editors/config-riscos.js

export const RiscosConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;
    let _targetTableId = null;

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        _targetTableId = tableId;
        const options = config || {};
        
        const mapping = options.mapping || {};
        const styling = options.styling || {};
        const actions = options.actions || {};

        state = {
            // Mapeamentos de Colunas
            idRiscoField: mapping.idRiscoField || 'IDRisco',
            nomeRiscoField: mapping.nomeRiscoField || 'NomeRisco',
            deptoField: mapping.deptoField || 'Departamento',
            probField: mapping.probField || 'ultprob',
            impactField: mapping.impactField || 'ultimpac',
            inherentProbField: mapping.inherentProbField || 'Probabilidade_Inerente_Num',
            inherentImpactField: mapping.inherentImpactField || 'Impacto_Inerente_Num',
            pasField: mapping.pasField || 'PAs',
            nextAnaliseField: mapping.nextAnaliseField || 'DataProxAnalise',
            descricaoField: mapping.descricaoField || 'Descricao',
            tratamentoField: mapping.tratamentoField || 'Ultimo_Tratamento',

            // Tabelas e Configurações Vinculadas
            analysesTableId: mapping.analysesTableId || 'Analise_Risco',
            tableConfigId: actions.tableConfigId || '',
            drawerConfigId: actions.drawerConfigId || '',
            
            // Estilo
            matrixWidth: styling.matrixWidth || '30%',
            
            receivedConfigs: receivedConfigs
        };

        tableLens.getTableSchema(tableId).then(schema => {
            const columns = Object.keys(schema);
            container.innerHTML = `
                <div class="config-tabs">
                    <button type="button" class="config-tab-button active" data-tab-id="mapping">Mapeamento</button>
                    <button type="button" class="config-tab-button" data-tab-id="styling">Estilo</button>
                    <button type="button" class="config-tab-button" data-tab-id="actions">Ações e Tabelas</button>
                </div>
                <div class="config-content">
                    <div data-tab-section="mapping">
                        <h3>Mapeamento de Colunas (Riscos)</h3>
                        <div class="form-group">
                            <label>Código do Risco (IDRisco):</label>
                            <select id="rk-id-risco" class="form-control">${createColumnOptions(columns, state.idRiscoField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Título do Risco (NomeRisco):</label>
                            <select id="rk-nome-risco" class="form-control">${createColumnOptions(columns, state.nomeRiscoField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Departamento / Área:</label>
                            <select id="rk-depto" class="form-control">${createColumnOptions(columns, state.deptoField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Probabilidade Atual:</label>
                            <select id="rk-prob" class="form-control">${createColumnOptions(columns, state.probField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Impacto Atual:</label>
                            <select id="rk-impact" class="form-control">${createColumnOptions(columns, state.impactField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Probabilidade Inerente:</label>
                            <select id="rk-inherent-prob" class="form-control">${createColumnOptions(columns, state.inherentProbField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Impacto Inerente:</label>
                            <select id="rk-inherent-impact" class="form-control">${createColumnOptions(columns, state.inherentImpactField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Planos de Ação (Contador):</label>
                            <select id="rk-pas" class="form-control">${createColumnOptions(columns, state.pasField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Próxima Análise (Data):</label>
                            <select id="rk-next-analise" class="form-control">${createColumnOptions(columns, state.nextAnaliseField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Descrição do Risco:</label>
                            <select id="rk-descricao" class="form-control">${createColumnOptions(columns, state.descricaoField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Tratamento Recomendado:</label>
                            <select id="rk-tratamento" class="form-control">${createColumnOptions(columns, state.tratamentoField)}</select>
                        </div>
                    </div>

                    <div data-tab-section="styling" style="display:none">
                        <h3>Configuração Visual</h3>
                        <div class="form-group">
                            <label>Largura Padrão da Matriz (%):</label>
                            <select id="rk-matrix-width" class="form-control">
                                <option value="25%" ${state.matrixWidth === '25%' ? 'selected' : ''}>25%</option>
                                <option value="30%" ${state.matrixWidth === '30%' ? 'selected' : ''}>30%</option>
                                <option value="35%" ${state.matrixWidth === '35%' ? 'selected' : ''}>35%</option>
                                <option value="40%" ${state.matrixWidth === '40%' ? 'selected' : ''}>40%</option>
                                <option value="45%" ${state.matrixWidth === '45%' ? 'selected' : ''}>45%</option>
                                <option value="50%" ${state.matrixWidth === '50%' ? 'selected' : ''}>50%</option>
                            </select>
                        </div>
                    </div>

                    <div data-tab-section="actions" style="display:none">
                        <h3>Configurações Vinculadas e Outras Tabelas</h3>
                        <div class="form-group">
                            <label>Tabela de Histórico (Análises):</label>
                            <input type="text" id="rk-analyses-table-id" class="form-control" value="${state.analysesTableId}" placeholder="Analise_Risco">
                        </div>
                        <div class="form-group">
                            <label>Configuração da Lista de Riscos (Componente Table ou Card System):</label>
                            <select id="rk-table-config-id" class="form-control">
                                <option value="">-- Usar Tabela Padrão (Sem Configurações) --</option>
                                ${state.receivedConfigs.filter(c => c.componentType === 'Table' || c.componentType === 'Card System').map(c => 
                                    `<option value="${c.configId}" ${c.configId === state.tableConfigId ? 'selected' : ''}>${c.widgetTitle} [${c.componentType}] (${c.configId})</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Configuração da Gaveta de Detalhes (Componente Drawer):</label>
                            <select id="rk-drawer-config-id" class="form-control">
                                <option value="">-- Usar Gaveta Padrão do Widget --</option>
                                ${state.receivedConfigs.filter(c => c.componentType === 'Drawer').map(c => 
                                    `<option value="${c.configId}" ${c.configId === state.drawerConfigId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;

            setupTabNavigation(container);

            // Trigger change event on any modification
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

    function createColumnOptions(columns, selected) {
        return `<option value="">-- Selecione --</option>` + 
            columns.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
    }

    function read(container) {
        const mapping = {
            tableId: _targetTableId,
            idRiscoField: container.querySelector('#rk-id-risco').value,
            nomeRiscoField: container.querySelector('#rk-nome-risco').value,
            deptoField: container.querySelector('#rk-depto').value,
            probField: container.querySelector('#rk-prob').value,
            impactField: container.querySelector('#rk-impact').value,
            inherentProbField: container.querySelector('#rk-inherent-prob').value,
            inherentImpactField: container.querySelector('#rk-inherent-impact').value,
            pasField: container.querySelector('#rk-pas').value,
            nextAnaliseField: container.querySelector('#rk-next-analise').value,
            descricaoField: container.querySelector('#rk-descricao').value,
            tratamentoField: container.querySelector('#rk-tratamento').value,
            analysesTableId: container.querySelector('#rk-analyses-table-id').value
        };

        const styling = {
            matrixWidth: container.querySelector('#rk-matrix-width').value
        };

        const actions = {
            tableConfigId: container.querySelector('#rk-table-config-id').value,
            drawerConfigId: container.querySelector('#rk-drawer-config-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();
window.RiscosConfigEditor = RiscosConfigEditor;
