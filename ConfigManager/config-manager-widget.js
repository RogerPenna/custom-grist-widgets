// config-manager-widget.js

import { GristTableLens } from '/libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '/libraries/grist-data-writer.js';
import { publish } from '/libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', function () {
    // 1. Referências aos Elementos do DOM
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');
    const configListEl = document.getElementById('configList');
    const configFormEl = document.getElementById('configForm');
    const recordIdInputEl = document.getElementById('recordIdInput');
    const configIdInputEl = document.getElementById('configIdInput');
    const descriptionInputEl = document.getElementById('descriptionInput');
    const configJsonTextareaEl = document.getElementById('configJsonTextarea');
	
    // Contêineres de UI Dinâmica
    const genericJsonEditorEl = document.getElementById('genericJsonEditor');
    const drawerEditorEl = document.getElementById('drawerEditor');
    const tableSelectorContainerEl = document.getElementById('tableSelectorContainer');
    const drawerControlsContainerEl = document.getElementById('drawerControlsContainer');
    
    const newConfigBtn = document.getElementById('newConfigBtn');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    // 2. Estado da Aplicação e Constantes
    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist);
    const CONFIG_TABLE_ID = 'Grf_config';
    let allConfigs = [];
    let selectedRecordId = null;
    let currentTableSchema = null; // Armazena o schema da tabela selecionada

    // 3. Funções Principais

    async function initializeApp() {
        await renderTableSelector();
        await loadAndRenderConfigs();
    }

    async function loadAndRenderConfigs() {
        showLoading(true);
        showError('');
        try {
            allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE_ID);
            allConfigs.sort((a, b) => a.configId.localeCompare(b.configId));
            renderConfigList();
            if (selectedRecordId) {
                const stillExists = allConfigs.some(c => c.id === selectedRecordId);
                stillExists ? await displayConfigDetails(selectedRecordId) : clearForm();
            } else {
                clearForm();
            }
        } catch (error) {
            showError(`Falha ao carregar configurações: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function renderConfigList() {
        configListEl.innerHTML = '';
        allConfigs.forEach(config => {
            const listItem = document.createElement('li');
            listItem.textContent = config.configId;
            listItem.dataset.recordId = config.id;
            listItem.className = 'config-list-item';
            listItem.addEventListener('click', () => displayConfigDetails(config.id));
            configListEl.appendChild(listItem);
        });
    }

    async function displayConfigDetails(recordId) {
        selectedRecordId = recordId;
        const config = allConfigs.find(c => c.id === recordId);
        if (!config) return clearForm();

        recordIdInputEl.value = config.id;
        configIdInputEl.value = config.configId || '';
        descriptionInputEl.value = config.description || '';
        configIdInputEl.readOnly = true;

        // Preenche o textarea primeiro, ele é a nossa "fonte da verdade"
        try {
            const parsedJson = JSON.parse(config.configJson || '{}');
            configJsonTextareaEl.value = JSON.stringify(parsedJson, null, 2);
        } catch (e) {
            configJsonTextareaEl.value = config.configJson || '';
        }

        const componentType = config.componentType;
        if (componentType === 'Drawer') {
            genericJsonEditorEl.classList.add('hidden'); // Esconde com CSS
            drawerEditorEl.style.display = 'block';
            if (document.getElementById('tableSelector').value) {
                await renderDrawerConfigUI();
            }
        } else {
            genericJsonEditorEl.classList.remove('hidden'); // Mostra
            drawerEditorEl.style.display = 'none';
        }

        document.querySelectorAll('.config-list-item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.recordId == recordId);
        });
    }
    
    function clearForm() {
        selectedRecordId = null;
        configFormEl.reset();
        recordIdInputEl.value = '';
        configIdInputEl.readOnly = false;
        genericJsonEditorEl.classList.remove('hidden');
        drawerEditorEl.style.display = 'none';
        drawerControlsContainerEl.innerHTML = '';
        currentTableSchema = null;
        const tableSelector = document.getElementById('tableSelector');
        if (tableSelector) {
            tableSelector.value = '';
        }
        document.querySelectorAll('.config-list-item.is-active').forEach(item => {
            item.classList.remove('is-active');
        });
    }

    async function handleSave() {
        console.log("--- handleSave INICIADO ---");
        showError('');
        const recordId = selectedRecordId;
        const configId = configIdInputEl.value.trim();
        if (!configId) return showError("O 'ID da Configuração' é obrigatório.");

        // A fonte da verdade é sempre o <textarea>
        let configJson;
        try {
            const rawJson = configJsonTextareaEl.value;
            console.log("1. JSON lido do textarea:", rawJson);
            JSON.parse(rawJson);
            configJson = rawJson;
        } catch (error) {
            console.error("ERRO: O JSON do textarea é inválido.", error);
            return showError(`O JSON da Configuração é inválido: ${error.message}`);
        }
        
        const existingConfig = allConfigs.find(c => c.id === recordId);
        const recordData = {
            configId,
            description: descriptionInputEl.value.trim(),
            configJson,
            componentType: existingConfig?.componentType || 'Drawer',
            pageId: existingConfig?.pageId || 0,
            widgetTitle: existingConfig?.widgetTitle || '',
        };

        console.log("2. Objeto 'recordData' a ser salvo:", recordData);
        
        showLoading(true);
        try {
            if (recordId) {
                console.log(`3. Chamando dataWriter.updateRecord para o recordId: ${recordId}`);
                await dataWriter.updateRecord(CONFIG_TABLE_ID, recordId, recordData);
                console.log("4. dataWriter.updateRecord concluído com sucesso.");
            } else {
                if (allConfigs.some(c => c.configId === configId)) throw new Error(`O ID '${configId}' já existe.`);
                console.log("3. Chamando dataWriter.addRecord...");
                const newRecord = await dataWriter.addRecord(CONFIG_TABLE_ID, recordData);
                selectedRecordId = newRecord.id;
                console.log("4. dataWriter.addRecord concluído com sucesso. Novo ID:", newRecord.id);
            }
            const eventData = { configId, action: 'save' };
            tableLens.clearConfigCache(configId);
            publish('config-changed', eventData);
            alert("Configuração salva com sucesso!");
        } catch (error) {
            console.error("ERRO CRÍTICO no bloco try/catch:", error);
            showError(`Erro ao salvar: ${error.message}`);
        } finally {
            console.log("5. Bloco 'finally' alcançado. Recarregando configs...");
            await loadAndRenderConfigs();
        }
    }

    async function handleDelete() {
        if (!selectedRecordId) return alert("Nenhuma configuração selecionada para deletar.");
        const configToDelete = allConfigs.find(c => c.id === selectedRecordId);
        if (!configToDelete) return;

        if (confirm(`Tem certeza que deseja deletar '${configToDelete.configId}'?`)) {
            showLoading(true);
            try {
                const configIdToDelete = configToDelete.configId;
                await dataWriter.deleteRecords(CONFIG_TABLE_ID, [selectedRecordId]);
                const eventData = { configId: configIdToDelete, action: 'delete' };
                tableLens.clearConfigCache(configIdToDelete);
                publish('config-changed', eventData);
                alert("Configuração deletada com sucesso!");
                selectedRecordId = null;
            } catch (error) {
                showError(`Erro ao deletar: ${error.message}`);
            } finally {
                await loadAndRenderConfigs();
            }
        }
    }

    // 4. Funções de UI Específicas
    
    async function renderTableSelector() {
        const allTables = await tableLens.listAllTables();
        let html = `<label for="tableSelector">Tabela de Dados para Configurar:</label>
                    <select id="tableSelector">
                        <option value="">-- Selecione uma Tabela --</option>`;
        allTables.forEach(table => {
            html += `<option value="${table.id}">${table.id}</option>`;
        });
        html += `</select>`;
        tableSelectorContainerEl.innerHTML = html;
        document.getElementById('tableSelector').addEventListener('change', async (e) => {
            const tableId = e.target.value;
            if (tableId) {
                currentTableSchema = await tableLens.getTableSchema(tableId);
                await renderDrawerConfigUI();
            } else {
                currentTableSchema = null;
                drawerControlsContainerEl.innerHTML = '<p>Selecione uma tabela para começar a configurar os campos.</p>';
            }
        });
    }

function updateJsonFromUI() {
        if (!currentTableSchema || drawerEditorEl.style.display === 'none') return;
        
        // --- NOSSO ESPIÃO ---
        console.log("Sincronizando UI -> JSON...");

        const drawerConfig = {};
        drawerConfig.width = document.getElementById('drawerWidthSelector').value;
        drawerConfig.fieldOrder = Array.from(document.querySelectorAll('#fieldOrderList .field-order-item')).map(el => el.dataset.colId);
        drawerConfig.hiddenFields = Array.from(document.querySelectorAll('#hiddenFieldsList input:checked')).map(el => el.dataset.colId);
        drawerConfig.lockedFields = Array.from(document.querySelectorAll('#lockedFieldsList input:checked')).map(el => el.dataset.colId);
        
        // Atualiza o <textarea> com o JSON formatado
        configJsonTextareaEl.value = JSON.stringify(drawerConfig, null, 2);
    }

    function addDrawerUIListeners() {
        drawerControlsContainerEl.addEventListener('change', updateJsonFromUI);
        
        const fieldOrderList = document.getElementById('fieldOrderList');
        if (fieldOrderList) {
            fieldOrderList.addEventListener('drop', () => {
                setTimeout(updateJsonFromUI, 0);
            });
        }
    }	

    async function renderDrawerConfigUI() {
        const configData = JSON.parse(configJsonTextareaEl.value || '{}');

        if (!currentTableSchema) {
            drawerControlsContainerEl.innerHTML = '<p>Selecione uma tabela para começar a configurar os campos.</p>';
            return;
        }
        
        const allCols = Object.values(currentTableSchema).filter(c => !c.colId.startsWith('gristHelper_') && c.type !== 'ManualSortPos');
        configData.fieldOrder = configData.fieldOrder || [];
        configData.hiddenFields = configData.hiddenFields || [];
        configData.lockedFields = configData.lockedFields || [];

        let html = `
            <div class="drawer-config-section">
                <label for="drawerWidthSelector">Largura do Drawer:</label>
                <select id="drawerWidthSelector">
                    ${['25%', '40%', '50%', '60%', '75%'].map(w => `<option value="${w}" ${configData.width === w ? 'selected' : ''}>${w}</option>`).join('')}
                </select>
            </div>
            <div class="drawer-config-section">
                <h4>Ordem dos Campos (Arraste para reordenar)</h4>
                <ul id="fieldOrderList" class="field-order-list"></ul>
            </div>
            <div class="drawer-config-section">
                <h4>Campos Ocultos</h4>
                <div id="hiddenFieldsList" class="field-grid"></div>
            </div>
            <div class="drawer-config-section">
                <h4>Campos Travados</h4>
                <div id="lockedFieldsList" class="field-grid"></div>
            </div>
        `;
        drawerControlsContainerEl.innerHTML = html;
        
        const orderedCols = [...configData.fieldOrder.map(id => allCols.find(c => c.colId === id)), ...allCols.filter(c => !configData.fieldOrder.includes(c.colId))].filter(Boolean);
        const fieldOrderListEl = document.getElementById('fieldOrderList');
        const hiddenFieldsListEl = document.getElementById('hiddenFieldsList');
        const lockedFieldsListEl = document.getElementById('lockedFieldsList');

        orderedCols.forEach(col => {
            const item = document.createElement('li');
            item.className = 'field-order-item';
            item.textContent = col.label;
            item.dataset.colId = col.colId;
            item.draggable = true;
            fieldOrderListEl.appendChild(item);
        });

        allCols.forEach(col => {
            hiddenFieldsListEl.innerHTML += `
                <label><input type="checkbox" data-col-id="${col.colId}" ${configData.hiddenFields.includes(col.colId) ? 'checked' : ''}> ${col.label}</label>
            `;
            lockedFieldsListEl.innerHTML += `
                <label><input type="checkbox" data-col-id="${col.colId}" ${configData.lockedFields.includes(col.colId) ? 'checked' : ''}> ${col.label}</label>
            `;
        });
        
        enableDragAndDrop();
        addDrawerUIListeners();
    }
    
    function enableDragAndDrop() {
        const list = document.getElementById('fieldOrderList');
        if (!list) return;
        let draggedItem = null;
        list.addEventListener('dragstart', e => {
            draggedItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        });
        list.addEventListener('dragend', e => {
            e.target.classList.remove('dragging');
        });
        list.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.field-order-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function showLoading(isLoading) { loadingMessageEl.style.display = isLoading ? 'block' : 'none'; }
    function showError(message) { errorMessageEl.textContent = message; errorMessageEl.style.display = message ? 'block' : 'none'; }

    // Event Listeners
    newConfigBtn.addEventListener('click', clearForm);
    configFormEl.addEventListener('submit', e => { e.preventDefault(); handleSave(); });
    deleteBtn.addEventListener('click', handleDelete);

    // Inicialização
    grist.ready({ requiredAccess: 'full' });
    initializeApp();
});