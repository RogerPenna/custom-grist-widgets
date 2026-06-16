// libraries/grist-config-manager/editors/config-timeline.js

export const TimelineConfigEditor = (() => {
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
            titleField: mapping.titleField || '',
            startDateField: mapping.startDateField || '',
            endDateField: mapping.endDateField || '',
            progressField: mapping.progressField || '',
            statusField: mapping.statusField || '',
            assigneeField: mapping.assigneeField || '',
            colorField: mapping.colorField || '',
            parentField: mapping.parentField || '',

            // Styling
            groupingField: styling.groupingField || '',
            defaultColor: styling.defaultColor || '#0dcaf0',
            showProgress: styling.showProgress !== false,

            // Actions
            drawerConfigId: actions.drawerConfigId || '',
            
            receivedConfigs: receivedConfigs
        };

        tableLens.getTableSchema(tableId).then(schema => {
            const columns = Object.keys(schema);
            container.innerHTML = `
                <div class="config-tabs">
                    <button type="button" class="config-tab-button active" data-tab-id="mapping">Mapeamento</button>
                    <button type="button" class="config-tab-button" data-tab-id="styling">Estilo</button>
                    <button type="button" class="config-tab-button" data-tab-id="actions">Ações</button>
                </div>
                <div class="config-content">
                    <div data-tab-section="mapping">
                        <h3>Mapeamento de Colunas</h3>
                        <div class="form-group">
                            <label>Título / Nome da Ação:</label>
                            <select id="tl-title-field" class="form-control">${createColumnOptions(columns, state.titleField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Data de Início:</label>
                            <select id="tl-start-date-field" class="form-control">${createColumnOptions(columns, state.startDateField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Data de Término / Prazo:</label>
                            <select id="tl-end-date-field" class="form-control">${createColumnOptions(columns, state.endDateField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Progresso / Atingimento (%):</label>
                            <select id="tl-progress-field" class="form-control">${createColumnOptions(columns, state.progressField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Status:</label>
                            <select id="tl-status-field" class="form-control">${createColumnOptions(columns, state.statusField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Responsável / Assignee:</label>
                            <select id="tl-assignee-field" class="form-control">${createColumnOptions(columns, state.assigneeField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Pai / Sub-ação de (Referência):</label>
                            <select id="tl-parent-field" class="form-control">${createColumnOptions(columns, state.parentField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Coluna de Cor (Texto Hex):</label>
                            <select id="tl-color-field" class="form-control">${createColumnOptions(columns, state.colorField)}</select>
                        </div>
                    </div>

                    <div data-tab-section="styling" style="display:none">
                        <h3>Configuração Visual</h3>
                        <div class="form-group">
                            <label>Agrupar por Coluna (Swimlanes):</label>
                            <select id="tl-grouping-field" class="form-control">
                                <option value="">-- Sem Agrupamento --</option>
                                ${columns.map(c => `<option value="${c}" ${c === state.groupingField ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cor Padrão dos Cards:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="color" id="tl-default-color" class="form-control" style="width: 50px; height: 38px; padding: 2px;" value="${state.defaultColor}">
                                <input type="text" id="tl-default-color-hex" class="form-control" style="flex: 1;" value="${state.defaultColor}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="tl-show-progress" ${state.showProgress ? 'checked' : ''}>
                                Mostrar barra de progresso interna
                            </label>
                        </div>
                    </div>

                    <div data-tab-section="actions" style="display:none">
                        <h3>Configuração de Ações</h3>
                        <div class="form-group">
                            <label>Abrir Gaveta ao Clicar:</label>
                            <select id="tl-drawer-id" class="form-control">
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

            // Sync color picker inputs
            const colorPicker = container.querySelector('#tl-default-color');
            const colorHex = container.querySelector('#tl-default-color-hex');
            colorPicker.oninput = () => { colorHex.value = colorPicker.value; colorPicker.dispatchEvent(new Event('change')); };
            colorHex.oninput = () => { if(/^#[0-9A-F]{6}$/i.test(colorHex.value)) { colorPicker.value = colorHex.value; colorHex.dispatchEvent(new Event('change')); } };

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
            titleField: container.querySelector('#tl-title-field').value,
            startDateField: container.querySelector('#tl-start-date-field').value,
            endDateField: container.querySelector('#tl-end-date-field').value,
            progressField: container.querySelector('#tl-progress-field').value,
            statusField: container.querySelector('#tl-status-field').value,
            assigneeField: container.querySelector('#tl-assignee-field').value,
            parentField: container.querySelector('#tl-parent-field').value,
            colorField: container.querySelector('#tl-color-field').value
        };

        const styling = {
            groupingField: container.querySelector('#tl-grouping-field').value,
            defaultColor: container.querySelector('#tl-default-color-hex').value,
            showProgress: container.querySelector('#tl-show-progress').checked
        };

        const actions = {
            drawerConfigId: container.querySelector('#tl-drawer-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();
window.TimelineConfigEditor = TimelineConfigEditor;
