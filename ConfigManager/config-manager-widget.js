// config-manager-widget.js (O NOVO DESPACHANTE)

import { GristTableLens } from '/libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '/libraries/grist-data-writer.js';
import { publish } from '/libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Referências aos Elementos do DOM
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');
    const configListEl = document.getElementById('configList');
    const configFormEl = document.getElementById('configForm');
    const recordIdInputEl = document.getElementById('recordIdInput');
    const configIdInputEl = document.getElementById('configIdInput');
    const descriptionInputEl = document.getElementById('descriptionInput');
    const genericJsonEditorEl = document.getElementById('genericJsonEditor');
    const drawerEditorEl = document.getElementById('drawerEditor'); // Contêiner principal para UIs dinâmicas
    const tableSelectorContainerEl = document.getElementById('tableSelectorContainer');
    const newConfigBtn = document.getElementById('newConfigBtn');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');
	const configJsonTextareaEl = document.getElementById('configJsonTextarea');

    // 2. Estado da Aplicação e Constantes
    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist);
    const CONFIG_TABLE_ID = 'Grf_config';
    let allConfigs = [];
    let selectedRecordId = null;
    let currentTableSchema = null;
    let currentEditorModule = null; // Armazena o módulo do editor carregado dinamicamente

    // --- Mapeamento de Editores Especialistas ---
    const editorMap = {
        'Drawer': '/ConfigManager/editors/config-drawer.js',
        // 'Cards': '/ConfigManager/editors/config-cards.js', // Exemplo para o futuro
    };

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
        currentEditorModule = null;
        const config = allConfigs.find(c => c.id === recordId);
        if (!config) return clearForm();

        recordIdInputEl.value = config.id;
        configIdInputEl.value = config.configId || '';
        descriptionInputEl.value = config.description || '';
        configIdInputEl.readOnly = true;

        const componentType = config.componentType;
        const editorPath = editorMap[componentType];

        // --- INÍCIO DA MUDANÇA PARA DEBUG ---
        
        // Primeiro, sempre preenchemos o textarea, que é a nossa fonte da verdade.
        try {
            const parsedJson = JSON.parse(config.configJson || '{}');
            configJsonTextareaEl.value = JSON.stringify(parsedJson, null, 2);
        } catch (e) {
            configJsonTextareaEl.value = config.configJson || '';
        }
        
        if (editorPath) {
            // MOSTRA OS DOIS: a UI especializada e o editor de JSON
            genericJsonEditorEl.style.display = 'block'; 
            drawerEditorEl.style.display = 'block';

            // Adiciona um título ao editor de JSON para clareza no debug
            genericJsonEditorEl.querySelector('label').textContent = "JSON Gerado (Monitor de Debug)";
            configJsonTextareaEl.readOnly = true; // Torna o textarea somente leitura

            document.getElementById('editorHeader').innerHTML = `<h3>Configurações de ${componentType}</h3>`;
            
            currentEditorModule = await import(editorPath);
            const configData = JSON.parse(config.configJson || '{}');
            
            const specializedUiContainer = document.getElementById('specializedUiContainer');
            currentEditorModule.render(specializedUiContainer, configData, currentTableSchema);
        } else {
            // Comportamento normal para outros tipos
            genericJsonEditorEl.style.display = 'block';
            drawerEditorEl.style.display = 'none';
            genericJsonEditorEl.querySelector('label').textContent = "JSON da Configuração (configJson)";
            configJsonTextareaEl.readOnly = false;
        }
        // --- FIM DA MUDANÇA PARA DEBUG ---

        document.querySelectorAll('.config-list-item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.recordId == recordId);
        });
    }
    
    function clearForm() {
        selectedRecordId = null;
        currentEditorModule = null;
        configFormEl.reset();
        recordIdInputEl.value = '';
        configIdInputEl.readOnly = false;
        genericJsonEditorEl.style.display = 'block';
        drawerEditorEl.style.display = 'none';
        currentTableSchema = null;
        const tableSelector = document.getElementById('tableSelector');
        if (tableSelector) tableSelector.value = '';
        document.querySelectorAll('.config-list-item.is-active').forEach(item => {
            item.classList.remove('is-active');
        });
    }

    async function handleSave() {
        showError('');
        const recordId = selectedRecordId;
        const configId = configIdInputEl.value.trim();
        if (!configId) return showError("O 'ID da Configuração' é obrigatório.");

        let configJson;
        try {
            const rawJson = document.getElementById('configJsonTextarea').value;
            JSON.parse(rawJson);
            configJson = rawJson;
        } catch (error) {
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
        
        showLoading(true);
        try {
            let savedRecordId = recordId;
            if (recordId) {
                await dataWriter.updateRecord(CONFIG_TABLE_ID, recordId, recordData);
            } else {
                if (allConfigs.some(c => c.configId === configId)) throw new Error(`O ID '${configId}' já existe.`);
                const newRecord = await dataWriter.addRecord(CONFIG_TABLE_ID, recordData);
                savedRecordId = newRecord.id;
                selectedRecordId = newRecord.id;
            }
            
            // --- INÍCIO DA NOVA LÓGICA DE ATUALIZAÇÃO ---
            // Em vez de recarregar tudo, atualizamos o estado localmente.
            const index = allConfigs.findIndex(c => c.id === savedRecordId);
            const savedData = { id: savedRecordId, ...recordData };
            if (index > -1) {
                allConfigs[index] = savedData; // Atualiza o registro existente
            } else {
                allConfigs.push(savedData); // Adiciona o novo registro
            }

            // Re-renderiza a lista da esquerda e o formulário com os dados atualizados
            renderConfigList();
            await displayConfigDetails(savedRecordId);
            // --- FIM DA NOVA LÓGICA DE ATUALIZAÇÃO ---

            const eventData = { configId, action: 'save' };
            tableLens.clearConfigCache(configId);
            publish('config-changed', eventData);
            alert("Configuração salva com sucesso!");

        } catch (error) {
            showError(`Erro ao salvar: ${error.message}`);
        } finally {
            showLoading(false); // Apenas esconde a mensagem de loading
        }
    }

    async function handleDelete() {
        // ... (função inalterada) ...
    }

    async function renderTableSelector() {
        const allTables = await tableLens.listAllTables();
        let html = `<label for="tableSelector">Tabela de Dados para Configurar:</label>
                    <select id="tableSelector">
                        <option value="">-- Selecione uma Tabela --</option>`;
        allTables.forEach(table => { html += `<option value="${table.id}">${table.id}</option>`; });
        html += `</select>`;
        tableSelectorContainerEl.innerHTML = html;
        document.getElementById('tableSelector').addEventListener('change', async (e) => {
            const tableId = e.target.value;
            if (tableId) {
                currentTableSchema = await tableLens.getTableSchema(tableId);
                // Re-renderiza a UI do editor atual com o novo schema
                if (selectedRecordId) await displayConfigDetails(selectedRecordId);
            } else {
                currentTableSchema = null;
                if (currentEditorModule) currentEditorModule.render(drawerEditorEl, {}, null);
            }
        });
    }

    function showLoading(isLoading) { loadingMessageEl.style.display = isLoading ? 'block' : 'none'; }
    function showError(message) { errorMessageEl.textContent = message; errorMessageEl.style.display = message ? 'block' : 'none'; }

    newConfigBtn.addEventListener('click', clearForm);
    configFormEl.addEventListener('submit', e => { e.preventDefault(); handleSave(); });
    deleteBtn.addEventListener('click', handleDelete);

    grist.ready({ requiredAccess: 'full' });
    initializeApp();
});