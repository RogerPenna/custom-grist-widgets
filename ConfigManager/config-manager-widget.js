// --- START OF COMPLETE AND FINAL config-manager-widget.js ---

import { GristTableLens } from '/libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '/libraries/grist-data-writer.js';
import { publish } from '/libraries/grist-event-bus/grist-event-bus.js';

document.addEventListener('DOMContentLoaded', async function () {
    const loadingMessageEl = document.getElementById('loadingMessage');
    const errorMessageEl = document.getElementById('errorMessage');
    const configListEl = document.getElementById('configList');
    const configFormEl = document.getElementById('configForm');
    const recordIdInputEl = document.getElementById('recordIdInput');
    const configIdInputEl = document.getElementById('configIdInput');
    const descriptionInputEl = document.getElementById('descriptionInput');
    const genericJsonEditorEl = document.getElementById('genericJsonEditor');
    const specializedEditorContainerEl = document.getElementById('specializedEditorContainer');
    const editorParentContainerEl = document.getElementById('drawerEditor');
    const tableSelectorContainerEl = document.getElementById('tableSelectorContainer');
    const newConfigBtn = document.getElementById('newConfigBtn');
    const newConfigTypeSelectorEl = document.getElementById('newConfigTypeSelector');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const configJsonTextareaEl = document.getElementById('configJsonTextarea');

    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist);
    const CONFIG_TABLE_ID = 'Grf_config';
    let allConfigs = [];
    let selectedConfig = null;

    const editorMap = {
        'Drawer': window.DrawerConfigEditor,
        'CardSystem': window.CardConfigEditor,
        'Table': window.TableConfigEditor,
    };

    async function initializeApp() {
        await renderTableSelector();
        await loadAndRenderConfigs();

        const urlParams = new URLSearchParams(window.location.search);
        const configIdFromUrl = urlParams.get('configId');
        if (configIdFromUrl) {
            const configToSelect = allConfigs.find(c => c.configId === configIdFromUrl);
            if (configToSelect) {
                displayConfigDetails(configToSelect);
            }
        }

        document.getElementById('tableSelector').addEventListener('change', () => {
            if (selectedConfig) {
                displayConfigDetails(selectedConfig);
            }
        });
    }

    async function loadAndRenderConfigs() {
        showLoading(true);
        showError('');
        try {
            allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE_ID);
            allConfigs.sort((a, b) => (a.configId || '').localeCompare(b.configId || ''));
            renderConfigList();
            
            const currentSelectedId = selectedConfig ? selectedConfig.id : null;
            if (currentSelectedId) {
                const stillExists = allConfigs.find(c => c.id === currentSelectedId);
                if (stillExists) {
                    await displayConfigDetails(stillExists);
                } else {
                    clearForm();
                }
            } else {
                clearForm();
            }
        } catch (error) {
            console.error("Erro ao carregar configs:", error);
            showError(`Falha ao carregar configurações: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function renderConfigList() {
        configListEl.innerHTML = '';
        allConfigs.forEach(config => {
            const listItem = document.createElement('li');
            listItem.textContent = config.configId || '[Sem ID]';
            listItem.dataset.recordId = config.id;
            listItem.className = 'config-list-item';
            listItem.addEventListener('click', () => {
                const newSelectedConfig = allConfigs.find(c => c.id === config.id);
                displayConfigDetails(newSelectedConfig);
            });
            configListEl.appendChild(listItem);
        });
    }

    async function displayConfigDetails(config) {
        selectedConfig = config;
        
        document.querySelectorAll('.config-list-item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.recordId == (config?.id || null));
        });

        if (!config) {
            return clearForm();
        }

        recordIdInputEl.value = config.id || '';
        configIdInputEl.value = config.configId || '';
        descriptionInputEl.value = config.description || '';
        configIdInputEl.readOnly = !!config.id;

        const componentType = config.componentType;
        const currentEditorModule = editorMap[componentType];
        
        try {
            configJsonTextareaEl.value = JSON.stringify(JSON.parse(config.configJson || '{}'), null, 2);
        } catch(e) {
            configJsonTextareaEl.value = config.configJson || '{}';
        }
        
        specializedEditorContainerEl.innerHTML = '';

        if (currentEditorModule) {
            editorParentContainerEl.style.display = 'block';
            genericJsonEditorEl.style.display = 'block';
            genericJsonEditorEl.querySelector('label').textContent = "JSON Gerado (Monitor de Debug)";
            configJsonTextareaEl.readOnly = true;

            document.getElementById('editorHeader').innerHTML = `<h3>Configurações de ${componentType}</h3>`;
            
            const tableId = document.getElementById('tableSelector').value;
            // CORREÇÃO CRÍTICA APLICADA AQUI
            console.log("[ConfigManager] Preste a renderizar o editor. Passando este allConfigs:", allConfigs);
await currentEditorModule.render(specializedEditorContainerEl, JSON.parse(config.configJson || '{}'), tableLens, tableId, allConfigs);
        } else {
            editorParentContainerEl.style.display = 'none';
            genericJsonEditorEl.style.display = 'block';
            genericJsonEditorEl.querySelector('label').textContent = "JSON da Configuração (configJson)";
            configJsonTextareaEl.readOnly = false;
        }
    }
    
    function createNewConfig() {
        const componentType = newConfigTypeSelectorEl.value;
        const newConfig = {
            id: null,
            configId: '',
            description: '',
            componentType: componentType,
            configJson: '{}'
        };
        displayConfigDetails(newConfig);
    }

    function clearForm() {
        selectedConfig = null;
        configFormEl.reset();
        recordIdInputEl.value = '';
        configIdInputEl.readOnly = false;
        editorParentContainerEl.style.display = 'none';
        genericJsonEditorEl.style.display = 'block';
        specializedEditorContainerEl.innerHTML = '';
        document.querySelectorAll('.config-list-item.is-active').forEach(item => item.classList.remove('is-active'));
    }

    async function handleSave() {
        if (!selectedConfig) return showError("Nenhuma configuração selecionada para salvar.");
        showError('');
        const recordId = selectedConfig.id || null;
        const configId = configIdInputEl.value.trim();
        if (!configId) return showError("O 'ID da Configuração' é obrigatório.");

        let configJson;
        const currentEditorModule = editorMap[selectedConfig.componentType];
        if (currentEditorModule && typeof currentEditorModule.read === 'function') {
            try {
                const optionsObject = currentEditorModule.read(specializedEditorContainerEl);
                configJson = JSON.stringify(optionsObject); // Removido o pretty print para economizar espaço
            } catch (error) {
                console.error("Erro lendo do editor:", error);
                return showError(`Erro ao ler dados da UI: ${error.message}`);
            }
        } else {
            return showError("Editor não encontrado para este tipo de componente.");
        }
        
        const recordData = {
            configId,
            description: descriptionInputEl.value.trim(),
            configJson,
            componentType: selectedConfig.componentType,
        };
        
        showLoading(true);
        try {
            let savedRecordId;
            if (recordId) {
                await dataWriter.updateRecord(CONFIG_TABLE_ID, recordId, recordData);
                savedRecordId = recordId;
            } else {
                if (allConfigs.some(c => c.configId === configId)) throw new Error(`O ID '${configId}' já existe.`);
                const newRecord = await dataWriter.addRecord(CONFIG_TABLE_ID, recordData);
                savedRecordId = newRecord.id;
            }
            
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'grf-config-saved', configId: configId }, window.location.origin);
            }
            
            publish('config-changed', { configId, action: 'save' });
            tableLens.clearConfigCache(configId);
            
            selectedConfig = { id: savedRecordId };
            await loadAndRenderConfigs();
            
            alert("Configuração salva com sucesso!");

        } catch (error) {
            showError(`Erro ao salvar: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }
    
    async function handleDelete() {
        if (!selectedConfig || !selectedConfig.id) return;
        if (!confirm(`Tem certeza que deseja deletar a configuração '${selectedConfig.configId}'?`)) return;
        
        showLoading(true);
        try {
            await dataWriter.deleteRecord(CONFIG_TABLE_ID, selectedConfig.id);
            publish('config-changed', { configId: selectedConfig.configId, action: 'delete' });
            tableLens.clearConfigCache(selectedConfig.configId);
            selectedConfig = null;
            await loadAndRenderConfigs();
            alert("Configuração deletada.");
        } catch (error) {
            showError(`Erro ao deletar: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    async function renderTableSelector() {
        const allTables = await tableLens.listAllTables();
        let html = `<label for="tableSelector">Tabela de Dados para Configurar:</label>
                    <select id="tableSelector"><option value="">-- Selecione uma Tabela --</option>`;
        allTables.forEach(table => { html += `<option value="${table.id}">${table.id}</option>`; });
        html += `</select>`;
        tableSelectorContainerEl.innerHTML = html;
    }
    
    function showLoading(isLoading) { loadingMessageEl.style.display = isLoading ? 'block' : 'none'; }
    function showError(message) { errorMessageEl.textContent = message; errorMessageEl.style.display = message ? 'block' : 'none'; }

    newConfigBtn.addEventListener('click', createNewConfig);
    configFormEl.addEventListener('submit', e => { e.preventDefault(); handleSave(); });
    deleteBtn.addEventListener('click', handleDelete);

    grist.ready({ requiredAccess: 'full' });
    initializeApp();
});

// --- END OF COMPLETE AND FINAL config-manager-widget.js ---