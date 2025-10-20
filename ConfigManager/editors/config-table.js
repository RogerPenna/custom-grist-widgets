window.TableConfigEditor = (() => {
    let state = {};

    async function render(container, config, lens, tableId, receivedConfigs = []) {
        if (!tableId) {
            container.innerHTML = '<p class="editor-placeholder">Selecione uma Tabela de Dados no menu acima para começar a configurar.</p>';
            return;
        }

        const schema = await lens.getTableSchema(tableId);
        if (!schema) {
            container.innerHTML = '<p class="editor-placeholder">Erro ao carregar o schema da tabela. Verifique o console.</p>';
            return;
        }

        const options = config || {};
        state = {
            fields: Object.values(schema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos'),
            selectedColumns: options.columns || [],
            onRowClickAction: options.onRowClickAction || null,
            allConfigs: receivedConfigs,
        };

        container.innerHTML = `
            <h3>Configurações da Tabela</h3>
            <div class="form-group">
                <h4>Colunas Visíveis</h4>
                <div id="table-columns-list"></div>
            </div>
            <hr>
            <div class="form-group">
                <h4>Ação ao Clicar na Linha</h4>
                <select id="on-row-click-action">
                    <option value="">-- Nenhuma Ação --</option>
                </select>
                <p class="help-text">Selecione uma configuração de 'Drawer' para abrir quando uma linha for clicada.</p>
            </div>
        `;

        const columnsList = container.querySelector('#table-columns-list');
        state.fields.forEach(field => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `col-${field.colId}`;
            checkbox.value = field.colId;
            checkbox.checked = state.selectedColumns.includes(field.colId);

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = field.label || field.colId;

            const div = document.createElement('div');
            div.appendChild(checkbox);
            div.appendChild(label);
            columnsList.appendChild(div);
        });

        const actionSelect = container.querySelector('#on-row-click-action');
        const drawerConfigs = state.allConfigs.filter(c => c.componentType === 'Drawer');
        drawerConfigs.forEach(c => {
            const option = document.createElement('option');
            option.value = c.configId;
            option.textContent = c.configId;
            actionSelect.appendChild(option);
        });

        if (state.onRowClickAction) {
            actionSelect.value = state.onRowClickAction;
        }
    }

    function read(container) {
        const selectedColumns = Array.from(container.querySelectorAll('#table-columns-list input:checked')).map(cb => cb.value);
        const onRowClickAction = container.querySelector('#on-row-click-action').value || null;

        return {
            columns: selectedColumns,
            onRowClickAction: onRowClickAction,
        };
    }

    return { render, read };
})();