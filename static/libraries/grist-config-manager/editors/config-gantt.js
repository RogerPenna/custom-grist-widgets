// libraries/grist-config-manager/editors/config-gantt.js

export const GanttConfigEditor = (() => {
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
            defaultColor: styling.defaultColor || '#ffc107',
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
                        <h3>Mapeamento de Colunas (Gantt)</h3>
                        <div class="form-group">
                            <label>Título / Nome da Ação:</label>
                            <select id="gt-title-field" class="form-control">${createColumnOptions(columns, state.titleField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Data de Início:</label>
                            <select id="gt-start-date-field" class="form-control">${createColumnOptions(columns, state.startDateField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Data de Término / Prazo:</label>
                            <select id="gt-end-date-field" class="form-control">${createColumnOptions(columns, state.endDateField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Progresso / Atingimento (%):</label>
                            <select id="gt-progress-field" class="form-control">${createColumnOptions(columns, state.progressField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Status:</label>
                            <select id="gt-status-field" class="form-control">${createColumnOptions(columns, state.statusField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Responsável / Assignee:</label>
                            <select id="gt-assignee-field" class="form-control">${createColumnOptions(columns, state.assigneeField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Pai / Sub-ação de (Referência para Hierarquia):</label>
                            <select id="gt-parent-field" class="form-control">${createColumnOptions(columns, state.parentField)}</select>
                        </div>
                        <div class="form-group">
                            <label>Coluna de Cor (Texto Hex):</label>
                            <select id="gt-color-field" class="form-control">${createColumnOptions(columns, state.colorField)}</select>
                        </div>
                    </div>

                    <div data-tab-section="styling" style="display:none">
                        <h3>Configuração Visual</h3>
                        <div class="form-group">
                            <label>Agrupar por Coluna (Swimlanes):</label>
                            <select id="gt-grouping-field" class="form-control">
                                <option value="">-- Sem Agrupamento --</option>
                                ${columns.map(c => `<option value="${c}" ${c === state.groupingField ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Cor Padrão das Barras:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <input type="color" id="gt-default-color" class="form-control" style="width: 50px; height: 38px; padding: 2px;" value="${state.defaultColor}">
                                <input type="text" id="gt-default-color-hex" class="form-control" style="flex: 1;" value="${state.defaultColor}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="gt-show-progress" ${state.showProgress ? 'checked' : ''}>
                                Mostrar barra de progresso interna
                            </label>
                        </div>
                    </div>

                    <div data-tab-section="actions" style="display:none">
                        <h3>Configuração de Ações</h3>
                        <div class="form-group">
                            <label>Abrir Gaveta ao Clicar na Barra:</label>
                            <select id="gt-drawer-id" class="form-control">
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
            const colorPicker = container.querySelector('#gt-default-color');
            const colorHex = container.querySelector('#gt-default-color-hex');
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
            titleField: container.querySelector('#gt-title-field').value,
            startDateField: container.querySelector('#gt-start-date-field').value,
            endDateField: container.querySelector('#gt-end-date-field').value,
            progressField: container.querySelector('#gt-progress-field').value,
            statusField: container.querySelector('#gt-status-field').value,
            assigneeField: container.querySelector('#gt-assignee-field').value,
            parentField: container.querySelector('#gt-parent-field').value,
            colorField: container.querySelector('#gt-color-field').value
        };

        const styling = {
            groupingField: container.querySelector('#gt-grouping-field').value,
            defaultColor: container.querySelector('#gt-default-color-hex').value,
            showProgress: container.querySelector('#gt-show-progress').checked
        };

        const actions = {
            drawerConfigId: container.querySelector('#gt-drawer-id').value
        };

        return { mapping, styling, actions };
    }

    return { render, read };
})();
window.GanttConfigEditor = GanttConfigEditor;
