// config-manager-widget.js

// Caminhos relativos à raiz do projeto, pois o widget é carregado por um lançador.
// Estes caminhos estão corrigidos para corresponder à sua estrutura de arquivos.
import { GristTableLens } from '/libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '/libraries/grist-data-writer.js';

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
    const newConfigBtn = document.getElementById('newConfigBtn');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    // 2. Estado da Aplicação e Constantes
    const tableLens = new GristTableLens(grist);
    const dataWriter = new GristDataWriter(grist); // Ativado!
    const CONFIG_TABLE_ID = 'Grf_config';
    let allConfigs = [];
    let selectedRecordId = null;

    // 3. Funções Principais

    /**
     * Busca os dados da tabela Grf_config e inicia a renderização.
     */
    async function loadAndRenderConfigs() {
        showLoading(true);
        showError(''); // Limpa erros antigos
        try {
            allConfigs = await tableLens.fetchTableRecords(CONFIG_TABLE_ID);
            allConfigs.sort((a, b) => a.configId.localeCompare(b.configId));
            renderConfigList();
            
            // Se um item estava selecionado, tenta selecioná-lo novamente
            if (selectedRecordId) {
                const stillExists = allConfigs.some(c => c.id === selectedRecordId);
                if (stillExists) {
                    displayConfigDetails(selectedRecordId);
                } else {
                    clearForm();
                }
            } else {
                clearForm();
            }

        } catch (error) {
            showError(`Falha ao carregar configurações: ${error.message}`);
            console.error(error);
        } finally {
            showLoading(false);
        }
    }

    /**
     * Preenche a lista no painel esquerdo com os configIds.
     */
    function renderConfigList() {
        configListEl.innerHTML = '';
        allConfigs.forEach(config => {
            const listItem = document.createElement('li');
            listItem.textContent = config.configId;
            listItem.dataset.recordId = config.id;
            listItem.className = 'config-list-item';
            
            listItem.addEventListener('click', () => {
                displayConfigDetails(config.id);
            });

            configListEl.appendChild(listItem);
        });
    }

    /**
     * Exibe os detalhes de uma configuração selecionada no formulário.
     * @param {number} recordId - O ID do registro Grist a ser exibido.
     */
    function displayConfigDetails(recordId) {
        selectedRecordId = recordId;
        const config = allConfigs.find(c => c.id === recordId);
        if (!config) {
            clearForm();
            return;
        }

        recordIdInputEl.value = config.id;
        configIdInputEl.value = config.configId || '';
        descriptionInputEl.value = config.description || '';
        
        try {
            const parsedJson = JSON.parse(config.configJson || '{}');
            configJsonTextareaEl.value = JSON.stringify(parsedJson, null, 2);
        } catch (e) {
            configJsonTextareaEl.value = config.configJson || '';
        }
        
        configIdInputEl.readOnly = true; // Não permite editar o ID de um registro existente
        document.querySelectorAll('.config-list-item').forEach(item => {
            item.classList.toggle('is-active', item.dataset.recordId == recordId);
        });
    }

    /**
     * Limpa o formulário para um novo registro ou quando nada está selecionado.
     */
    function clearForm() {
        selectedRecordId = null;
        configFormEl.reset();
        recordIdInputEl.value = '';
        configIdInputEl.readOnly = false; // Permite editar o ID para um novo registro
        document.querySelectorAll('.config-list-item.is-active').forEach(item => {
            item.classList.remove('is-active');
        });
    }

    /**
     * Lida com o evento de salvar (adicionar ou atualizar).
     */
    async function handleSave() {
        showError('');
        const recordId = selectedRecordId;
        const configId = configIdInputEl.value.trim();

        // Validação 1: O ID da configuração não pode ser vazio.
        if (!configId) {
            showError("O 'ID da Configuração' é obrigatório.");
            return;
        }

        // Validação 2: O JSON deve ser válido.
        let configJson;
        try {
            // Verifica se o JSON é válido fazendo o parse.
            JSON.parse(configJsonTextareaEl.value);
            configJson = configJsonTextareaEl.value;
        } catch (error) {
            showError(`O JSON da Configuração é inválido: ${error.message}`);
            return;
        }

        const recordData = {
            configId: configId,
            description: descriptionInputEl.value.trim(),
            configJson: configJson,
        };

        showLoading(true);
        try {
            if (recordId) {
                // Modo de ATUALIZAÇÃO
                await dataWriter.updateRecord(CONFIG_TABLE_ID, recordId, recordData);
            } else {
                // Modo de ADIÇÃO
                // Validação 3: Não permite adicionar um configId que já existe.
                if (allConfigs.some(c => c.configId === configId)) {
                    throw new Error(`O ID de configuração '${configId}' já existe. Use um nome diferente.`);
                }
                const newRecord = await dataWriter.addRecord(CONFIG_TABLE_ID, recordData);
                selectedRecordId = newRecord.id; // Seleciona o novo item após a recarga
            }
            alert("Configuração salva com sucesso!");
        } catch (error) {
            showError(`Erro ao salvar: ${error.message}`);
        } finally {
            // Recarrega a lista para refletir as mudanças
            await loadAndRenderConfigs();
            showLoading(false);
        }
    }

    /**
     * Lida com o evento de deletar.
     */
    async function handleDelete() {
        if (!selectedRecordId) {
            alert("Nenhuma configuração selecionada para deletar.");
            return;
        }

        const configToDelete = allConfigs.find(c => c.id === selectedRecordId);
        if (confirm(`Tem certeza que deseja deletar a configuração '${configToDelete.configId}'?`)) {
            showLoading(true);
            try {
                await dataWriter.deleteRecords(CONFIG_TABLE_ID, [selectedRecordId]);
                alert("Configuração deletada com sucesso!");
                selectedRecordId = null; // Garante que o item deletado não será pré-selecionado
            } catch (error) {
                showError(`Erro ao deletar: ${error.message}`);
            } finally {
                await loadAndRenderConfigs();
                showLoading(false);
            }
        }
    }

    // 4. Funções de UI Auxiliares
    function showLoading(isLoading) {
        loadingMessageEl.style.display = isLoading ? 'block' : 'none';
    }
    function showError(message) {
        errorMessageEl.textContent = message;
        errorMessageEl.style.display = message ? 'block' : 'none';
    }

    // 5. Event Listeners
    newConfigBtn.addEventListener('click', clearForm);
    configFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSave();
    });
    deleteBtn.addEventListener('click', handleDelete);

    // 6. Inicialização
    grist.ready({ requiredAccess: 'full' });
    loadAndRenderConfigs();
});