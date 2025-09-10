// js/modaud_main.js

import { getTableData, updateQuestions } from './modaud_grist.js';
import { renderizarPerguntas } from './modaud_ui.js';

// ---- CONSTANTES E ESTADO ----
const TABELA_MESTRES = 'Modelos_Auditoria_Mestres';

// Elementos do DOM - FILTROS E BOTÕES PRINCIPAIS
const selectModeloMestre = document.getElementById('select-modelo-mestre');
const selectContexto = document.getElementById('select-contexto');
const labelContexto = document.getElementById('label-contexto');
const containerPerguntas = document.getElementById('lista-perguntas');
const btnSalvar = document.getElementById('btn-salvar');
const btnNovoItem = document.getElementById('btn-novo-item');

// Elementos do DOM - MODAL DE CLONAGEM
const btnAbrirClonador = document.getElementById('btn-abrir-clonador');
const modalClonador = document.getElementById('modal-clonador');
const clonadorCloseBtn = document.getElementById('clonador-close-btn');
const clonadorCancelBtn = document.getElementById('clonador-cancel-btn');
const clonadorConfirmBtn = document.getElementById('clonador-confirm-btn');
const clonadorSelectOrigem = document.getElementById('clonador-select-origem');
const clonadorSelectDestino = document.getElementById('clonador-select-destino');

// Elementos do DOM - MODAL DE CÓPIA PARA AUDITORIA
const btnAbrirCopiador = document.getElementById('btn-abrir-copiador');
const modalCopiador = document.getElementById('modal-copiador');
const copiadorCloseBtn = document.getElementById('copiador-close-btn');
const copiadorCancelBtn = document.getElementById('copiador-cancel-btn');
const copiadorConfirmBtn = document.getElementById('copiador-confirm-btn');
const copiadorSelectAuditoria = document.getElementById('copiador-select-auditoria');
const copiadorCheckMultiplas = document.getElementById('copiador-check-multiplas');
const copiadorAreaUnicaContainer = document.getElementById('copiador-area-unica-container');
const copiadorSelectAreaUnica = document.getElementById('copiador-select-area-unica');
const copiadorAreasMultiplasContainer = document.getElementById('copiador-areas-multiplas-container');

// Elementos do DOM - DRAWER DE EDIÇÃO
const drawerEl = document.getElementById('drawer');
const drawerOverlayEl = document.getElementById('drawer-overlay');
const drawerTitleEl = document.getElementById('drawer-title');
const drawerContentEl = document.getElementById('drawer-content');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerSaveBtn = document.getElementById('drawer-save-btn');
const drawerDeleteBtn = document.getElementById('drawer-delete-btn');

// Estado da Aplicação
let todosModelosMestres = [];
let modeloMestreSelecionado = null;
let contextoSelecionadoId = null;
let estadoOriginalPerguntas = [];
let sortableInstances = [];
let _schemaCache = { allTables: null, allColumns: null };
let editingRecordId = null;
let mapaTiposResposta = new Map();

 /**
 * @param {string} colId - O ID da coluna (ex: "Tipo_Item").
 * @param {string} selectedValue - O valor que deve ser pré-selecionado.
 * @returns {string} O HTML das <option>s.
 */
function getOptions(colId, selectedValue) {
    const { allTables, allColumns } = _schemaCache;
    const perguntasTableMeta = allTables.find(t => t.tableId === 'Modelos_Perguntas');
    const colMeta = allColumns.find(c => String(c.parentId) === String(perguntasTableMeta.id) && c.colId === colId);

    if (colMeta && colMeta.widgetOptions) {
        try {
            const choices = JSON.parse(colMeta.widgetOptions).choices || [];
            return choices.map(opt => `<option value="${opt}" ${selectedValue === opt ? 'selected' : ''}>${opt}</option>`).join('');
        } catch(e) {
            console.error(`Erro ao parsear widgetOptions para a coluna ${colId}`, e);
            return '';
        }
    }
    return '';
}

// ---- INICIALIZAÇÃO ----
async function main() {
    await grist.ready({ requiredAccess: 'full' });
    await _loadSchemaCache();
    await inicializarApp();
}

async function inicializarApp() {
    try {
        todosModelosMestres = await getTableData(TABELA_MESTRES);
        popularSelectModeloMestre();
        
        // Listeners da UI Principal
        selectModeloMestre.addEventListener('change', onModeloMestreChange);
        selectContexto.addEventListener('change', onContextoChange);
        btnSalvar.addEventListener('click', salvarAlteracoes); // <-- LINHA RESTAURADA
        btnNovoItem.addEventListener('click', () => criarNovoItem());

        // Listeners do Drawer de Edição
        drawerCloseBtn.addEventListener('click', closeDrawer);
        drawerOverlayEl.addEventListener('click', closeDrawer);
        drawerSaveBtn.addEventListener('click', saveDrawerChanges);
        drawerDeleteBtn.addEventListener('click', deleteRecordFromDrawer);

        // Listeners do Modal de Clonagem
        btnAbrirClonador.addEventListener('click', abrirModalClonador);
        clonadorCloseBtn.addEventListener('click', () => modalClonador.style.display = 'none');
        clonadorCancelBtn.addEventListener('click', () => modalClonador.style.display = 'none');
        // A linha 'clonadorConfirmBtn.addEventListener' foi REMOVIDA daqui. Ela é a causa do erro de PointerEvent.
        // A lógica de clique deste botão é definida DENTRO de 'abrirModalClonador'.
        
        // Listeners do Modal de Cópia
        btnAbrirCopiador.addEventListener('click', abrirModalCopiador);
        copiadorCloseBtn.addEventListener('click', () => modalCopiador.style.display = 'none');
        copiadorCancelBtn.addEventListener('click', () => modalCopiador.style.display = 'none');
        copiadorConfirmBtn.addEventListener('click', executarCopia); // A função de cópia correta
        copiadorCheckMultiplas.addEventListener('change', alternarModoCopia);
        
    } catch (e) {
        console.error("Erro fatal na inicialização:", e);
        containerPerguntas.innerHTML = `<p style="color:red; padding: 10px;">${e.message}</p>`;
    }
}

// ---- LÓGICA DE DESCOBERTA DE METADADOS ----

function mapColumnsToRows(dataAsColumns) {
    if (!dataAsColumns || typeof dataAsColumns.id === 'undefined' || dataAsColumns.id.length === 0) return [];
    const keys = Object.keys(dataAsColumns);
    const numRows = dataAsColumns.id.length;
    const dataAsRows = [];
    for (let i = 0; i < numRows; i++) {
        const row = {};
        for (const key of keys) { row[key] = dataAsColumns[key][i]; }
        dataAsRows.push(row);
    }
    return dataAsRows;
}

async function _loadSchemaCache() {
    if (!_schemaCache.allTables) {
        _schemaCache.allTables = mapColumnsToRows(await grist.docApi.fetchTable('_grist_Tables'));
    }
    if (!_schemaCache.allColumns) {
        _schemaCache.allColumns = mapColumnsToRows(await grist.docApi.fetchTable('_grist_Tables_column'));
    }
}

// Substitua esta função inteira em js/modaud_main.js

async function discoverContextInfo(refColId) {
    // Carrega os metadados brutos das tabelas de sistema, como o Kanban faz.
    await _loadSchemaCache();
    const { allTables, allColumns } = _schemaCache;

    console.log("----------------- INÍCIO DA PROVA -----------------");

    // PASSO 1: Encontrar a tabela de perguntas
    const perguntasTableMeta = allTables.find(t => t.tableId === 'Modelos_Perguntas'); // <-- CORRIGIDO AQUI
    if (!perguntasTableMeta) throw new Error("PROVA FALHOU: Tabela 'Modelos_Perguntas' não encontrada nos metadados.");
    
    // PASSO 2: Encontrar a coluna de referência (Referencia_Area) dentro da tabela de perguntas
    const refColMeta = allColumns.find(c => String(c.parentId) === String(perguntasTableMeta.id) && c.colId === refColId);
    if (!refColMeta) throw new Error(`PROVA FALHOU: Coluna '${refColId}' não encontrada em 'Modelos_Perguntas'.`);
    
    console.log(`[PROVA 1] Metadados da coluna '${refColId}' encontrados:`, refColMeta);

    // PASSO 3: Ler a propriedade 'displayCol'. Deve ser '99'.
    const displayColNumericId = refColMeta.displayCol;
    if (!displayColNumericId) throw new Error(`PROVA FALHOU: A propriedade 'displayCol' está vazia ou nula para a coluna '${refColId}'.`);

    console.log(`[PROVA 2] O valor de 'displayCol' para '${refColId}' é:`, displayColNumericId, `(Tipo: ${typeof displayColNumericId})`);
    
    // PASSO 4: Encontrar a coluna cujo 'id' corresponde ao valor da 'displayCol'.
    const displayColMeta = allColumns.find(c => String(c.id) === String(displayColNumericId));
    if (!displayColMeta) {
        console.error("[ERRO CRÍTICO] Lista completa de colunas para busca:", allColumns);
        throw new Error(`PROVA FALHOU: Não foi encontrada nenhuma coluna com o id=${displayColNumericId}.`);
    }

    console.log(`[PROVA 3] Metadados da coluna de display (id=${displayColNumericId}) encontrados:`, displayColMeta);

    // PASSO 5: Verificar se a coluna encontrada é a 'gristHelper_Display3' e ler sua fórmula.
    const finalDisplayColId = displayColMeta.colId;
    const finalFormula = displayColMeta.formula;
    console.log(`[PROVA 4] O 'colId' da coluna de display é '${finalDisplayColId}'.`);
    console.log(`[PROVA 5] A fórmula da coluna de display é '${finalFormula}'.`);

    if (!finalFormula || !finalFormula.includes('.')) {
        throw new Error(`PROVA FALHOU: A fórmula '${finalFormula}' não parece válida para extrair o nome da coluna.`);
    }

    // EXTRAÇÃO FINAL (usando a fórmula como a fonte da verdade, provada pela displayCol)
    const extractedDisplayCol = finalFormula.split('.')[1];
    console.log(`[PROVA 6 - SUCESSO] A coluna de exibição extraída da fórmula é: '${extractedDisplayCol}'`);
    
    console.log("----------------- FIM DA PROVA -----------------");


    // O resto da lógica para buscar os dados da tabela de contexto...
    // Esta lógica aqui estava com um bug também, vamos usar a extração direta do tipo Ref:
    const contextTableId = refColMeta.type.split(':')[1];
    
    const contextRecords = await getTableData(contextTableId);
    
    return {
        contextRecords,
        displayColId: extractedDisplayCol, // Usamos o valor que provamos ser o correto
        label: refColMeta.label || refColId
    };
}


// ---- FUNÇÕES DE UI E LÓGICA DE NEGÓCIO ----

function popularSelectModeloMestre() {
    selectModeloMestre.innerHTML = '<option value="">-- Selecione um Modelo --</option>';
    const modelosAtivos = todosModelosMestres.filter(m => m.Ativo);
    for (const modelo of modelosAtivos) {
        const option = document.createElement('option');
        option.value = modelo.id;
        option.textContent = modelo.Nome_Mestre;
        selectModeloMestre.appendChild(option);
    }
}

async function onModeloMestreChange() {
    const modeloId = parseInt(selectModeloMestre.value, 10);
    resetarContextoEPerguntas();

    if (!modeloId) {
        modeloMestreSelecionado = null;
        return;
    }
    modeloMestreSelecionado = todosModelosMestres.find(m => m.id === modeloId);
    if (!modeloMestreSelecionado) return;
    
    btnAbrirClonador.disabled = false; // Habilita o botão de clonar
    const colunaFiltroId = modeloMestreSelecionado.Coluna_Filtro_Perguntas;

    if (!colunaFiltroId) {
        labelContexto.textContent = "Contexto:";
        selectContexto.disabled = true;
        await carregarPerguntas();
    } else {
        try {
            const { contextRecords, displayColId, label } = await discoverContextInfo(colunaFiltroId);
            labelContexto.textContent = `${label}:`;
            popularSelectContexto(contextRecords, displayColId);
            selectContexto.disabled = false;
        } catch(e) {
            console.error(`Erro ao processar o contexto para a coluna de filtro '${colunaFiltroId}':`, e);
            containerPerguntas.innerHTML = `<p style="color:red; padding: 10px;">${e.message}</p>`;
        }
    }
}

function popularSelectContexto(records, displayColId) {
    selectContexto.innerHTML = '<option value="">-- Selecione --</option>';
    if (!records || records.length === 0) return;
    
    if (!records[0].hasOwnProperty(displayColId)) {
        displayColId = 'id';
    }

    for (const record of records) {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = record[displayColId] || `ID ${record.id}`;
        selectContexto.appendChild(option);
    }
}


function resetarContextoEPerguntas() {
    labelContexto.textContent = "Contexto:";
    selectContexto.innerHTML = '<option value="">-- Selecione --</option>';
    selectContexto.disabled = true;
    containerPerguntas.innerHTML = '<p>Selecione um Modelo e um Contexto para começar.</p>';
    btnSalvar.disabled = true;
    estadoOriginalPerguntas = [];
    btnAbrirClonador.disabled = true;
    btnAbrirCopiador.disabled = true;
    btnNovoItem.disabled = true;
}

// AÇÃO: Substitua a sua função carregarPerguntas inteira por esta.
// AÇÃO: Substitua a sua função carregarPerguntas inteira por esta.
async function carregarPerguntas() {
    const btnSalvar = document.getElementById('btn-salvar');
    
    if (!modeloMestreSelecionado) return;
    containerPerguntas.innerHTML = '<p>Carregando perguntas...</p>';
    if (btnSalvar) btnSalvar.disabled = true;

    try {
        const modeloMestreId = modeloMestreSelecionado.id;
        const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
        
        // CORREÇÃO: Busca os tipos de resposta JUNTO com as perguntas para garantir que os dados de suporte estão sempre atualizados.
        const [todasAsPerguntasDoModelo, tiposDeResposta] = await Promise.all([
            getTableData('Modelos_Perguntas', { Ref_Modelo_Mestre: [modeloMestreId] }),
            getTableData('Tipos_Respostas_Grupos')
        ]);
        
        // Cria o mapa atualizado com os dados frescos.
        const mapaTiposResposta = new Map(tiposDeResposta.map(tipo => [tipo.id, tipo.Tipo_Resposta]));

        let perguntasFiltradas = todasAsPerguntasDoModelo;
        if (colunaFiltro && contextoSelecionadoId) {
            perguntasFiltradas = todasAsPerguntasDoModelo.filter(p => String(p[colunaFiltro]) === String(contextoSelecionadoId));
        }
        
        estadoOriginalPerguntas = JSON.parse(JSON.stringify(perguntasFiltradas));
        
        // Passa o mapa FRESCO para a função de renderização.
        renderizarPerguntas(containerPerguntas, perguntasFiltradas, { mapaTiposResposta });
        configurarSortable();

        // Anexa todos os event listeners necessários após a renderização.
        containerPerguntas.querySelectorAll('.pergunta-card').forEach(card => {
            const recordId = parseInt(card.dataset.id, 10);
            
            card.querySelector('.edit-btn')?.addEventListener('click', () => { openDrawerForRecord(recordId); });
            card.querySelector('.add-child-btn')?.addEventListener('click', () => { criarNovoItem(recordId); });

            const textoEl = card.querySelector('.pergunta-texto');
            if (textoEl) {
                textoEl.addEventListener('click', () => {
                    if (document.querySelector('.inline-edit-container')) return;

                    const originalText = textoEl.textContent;
                    
                    const container = document.createElement('div');
                    container.className = 'inline-edit-container';
                    
                    const inputEl = document.createElement('input');
                    inputEl.type = 'text';
                    inputEl.value = originalText;
                    inputEl.className = 'inline-edit';

                    const actionsEl = document.createElement('div');
                    actionsEl.className = 'inline-edit-actions';
                    actionsEl.innerHTML = `
                        <button class="inline-confirm" title="Salvar (Enter)">✔️</button>
                        <button class="inline-cancel" title="Cancelar (Escape)">❌</button>
                    `;
                    
                    container.appendChild(inputEl);
                    container.appendChild(actionsEl);

                    textoEl.style.display = 'none';
                    textoEl.parentElement.insertBefore(container, textoEl);
                    inputEl.focus();
                    inputEl.select();

                    const finalizarEdicao = async (salvar = false) => {
                        if (!container.parentElement) return;

                        const newText = inputEl.value;
                        container.remove();
                        textoEl.style.display = '';

                        if (!salvar || newText === originalText) {
                            textoEl.textContent = originalText;
                            return;
                        }

                        textoEl.textContent = newText;
                        try {
                            await updateQuestions([{ id: recordId, fields: { Texto_Pergunta: newText } }]);
                            const recordInState = estadoOriginalPerguntas.find(p => p.id === recordId);
                            if (recordInState) recordInState.Texto_Pergunta = newText;
                        } catch (err) {
                            alert('Falha ao salvar: ' + err.message);
                            textoEl.textContent = originalText;
                        }
                    };
                    
                    actionsEl.querySelector('.inline-confirm').onclick = () => finalizarEdicao(true);
                    actionsEl.querySelector('.inline-cancel').onclick = () => finalizarEdicao(false);

                    inputEl.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            finalizarEdicao(true);
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            finalizarEdicao(false);
                        }
                    });
                });
            }
        });
        
        containerPerguntas.querySelectorAll('.add-sibling-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parentContainer = e.target.closest('.sortable-list');
                const parentId = parseInt(parentContainer.dataset.parentId, 10) || 0;
                criarNovoItem(parentId);
            });
        });

        containerPerguntas.querySelectorAll('.visibility-capsule').forEach(capsule => {
            const card = capsule.closest('.pergunta-card');
            if (!card) return;
            
            const recordId = parseInt(card.dataset.id, 10);
            const record = estadoOriginalPerguntas.find(p => p.id === recordId);
            
            if (record && record.Visibilidade_DependeDe > 0) {
                const parentQuestionCard = containerPerguntas.querySelector(`.pergunta-card[data-id="${record.Visibilidade_DependeDe}"]`);
                if (parentQuestionCard) {
                    capsule.addEventListener('mouseenter', () => {
                        parentQuestionCard.style.outline = '2px solid #f97316';
                        parentQuestionCard.style.outlineOffset = '2px';
                    });
                    capsule.addEventListener('mouseleave', () => {
                        parentQuestionCard.style.outline = 'none';
                    });
                }
            }
        });

    } catch (e) {
        console.error("Erro ao carregar perguntas:", e);
        containerPerguntas.innerHTML = `<p style="color:red; padding: 10px;">${e.message}</p>`;
    }
}

function configurarSortable() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    document.querySelectorAll('.sortable-list').forEach(container => {
        const instance = new Sortable(container, {
            group: 'perguntas',
            animation: 150,
            handle: '.drag-handle',
            onEnd: function (evt) {
                // Habilita o botão 'Salvar Alterações' quando um movimento é completado.
                console.log("Movimento de drag-and-drop concluído. Habilitando o botão Salvar.");
                btnSalvar.disabled = false;
            }
        });
        sortableInstances.push(instance);
    });
}

async function salvarEstruturaAtual() {
    saveStatusEl.textContent = 'Salvando...';

    const updates = [];
    
    // Mapeia o estado atual da UI (DOM)
    const estadoAtualMap = new Map();
    document.querySelectorAll('.pergunta-card').forEach(card => {
        const recordId = parseInt(card.dataset.id, 10);
        const parentContainer = card.closest('.sortable-list');
        const novoPaiId = parseInt(parentContainer.dataset.parentId, 10) || 0;
        
        // A ordem é a posição do card dentro do seu container pai
        const siblings = Array.from(parentContainer.children).filter(el => el.classList.contains('card-wrapper'));
        const novaOrdem = siblings.findIndex(wrapper => wrapper.contains(card));

        estadoAtualMap.set(recordId, { ID_Pai: novoPaiId, Ordem: novaOrdem });
    });

    // Compara o estado original com o atual para encontrar o que mudou
    // Itera sobre o estado atual, pois pode haver novos itens não presentes no original
    for (const [recordId, estadoAtual] of estadoAtualMap.entries()) {
        const originalRecord = estadoOriginalPerguntas.find(p => p.id === recordId);
        
        // Se não encontrar o registro original, é um item novo, não precisa de update de estrutura.
        if (!originalRecord) continue;

        const mudouPai = (originalRecord.ID_Pai || 0) !== estadoAtual.ID_Pai;
        const mudouOrdem = (originalRecord.Ordem || 0) !== estadoAtual.Ordem;

        if (mudouPai || mudouOrdem) {
            updates.push({
                id: recordId,
                fields: {
                    ID_Pai: estadoAtual.ID_Pai,
                    Ordem: estadoAtual.Ordem
                }
            });
        }
    }

    if (updates.length === 0) {
        saveStatusEl.textContent = 'Tudo salvo!';
        setTimeout(() => saveStatusEl.textContent = '', 2000);
        return;
    }

    try {
        await updateQuestions(updates);
        saveStatusEl.textContent = 'Salvo!';
        
        // IMPORTANTE: Após salvar, precisamos recarregar os dados para que 
        // o 'estadoOriginalPerguntas' seja atualizado para a próxima comparação.
        await carregarPerguntas();

    } catch (err) {
        console.error("Erro no auto-save:", err);
        saveStatusEl.textContent = 'Erro ao salvar!';
        alert(`Falha ao salvar automaticamente: ${err.message}`);
    } finally {
        setTimeout(() => saveStatusEl.textContent = '', 2000);
    }
}

// Ponto de entrada
main().catch(err => {
    console.error("Erro crítico no nível superior do widget:", err);
    const container = document.getElementById('lista-perguntas');
    if (container) {
        container.innerHTML = `<p style="color:red; padding:10px;">Um erro crítico impediu o widget de carregar: ${err.message}</p>`;
    }
});

async function criarNovoItem(parentId = 0) {
    if (!modeloMestreSelecionado) {
        alert("Selecione um Modelo Mestre primeiro.");
        return;
    }
    
    const textoPergunta = prompt("Digite o texto para o novo item:");
    if (!textoPergunta || textoPergunta.trim() === '') {
        return;
    }

    let ordem = 0;
    if (parentId === 0) {
        ordem = containerPerguntas.querySelectorAll(':scope > .card-wrapper').length;
    } else {
        const parentContainer = document.querySelector(`.sub-perguntas-container[data-parent-id="${parentId}"]`);
        ordem = parentContainer ? parentContainer.querySelectorAll(':scope > .card-wrapper').length : 0;
    }

    const novoItemFields = {
        Ref_Modelo_Mestre: modeloMestreSelecionado.id,
        Texto_Pergunta: textoPergunta,
        Tipo_Item: "Pergunta",
        ID_Pai: parentId,
        Ordem: ordem,
    };
    
    const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
    if (colunaFiltro && contextoSelecionadoId) {
        novoItemFields[colunaFiltro] = contextoSelecionadoId;
    }

    try {
        // TÉCNICA ROBUSTA PARA OBTER O NOVO ID:
        // 1. Pega a lista de IDs existentes ANTES de adicionar.
        const idsAntes = new Set(estadoOriginalPerguntas.map(p => p.id));
        
        // 2. Adiciona o novo registro.
        await grist.docApi.applyUserActions([['AddRecord', 'Modelos_Perguntas', null, novoItemFields]]);
        console.log("Comando para adicionar novo item enviado com sucesso.");
        
        // 3. Recarrega os dados.
        await carregarPerguntas();

        // 4. Compara a nova lista de IDs com a antiga para encontrar o novo ID.
        const idsDepois = new Set(estadoOriginalPerguntas.map(p => p.id));
        const newRecordId = [...idsDepois].find(id => !idsAntes.has(id));

        if (newRecordId) {
            console.log(`Novo item encontrado com ID: ${newRecordId}. Abrindo drawer.`);
            openDrawerForRecord(newRecordId);
        } else {
            console.warn("Não foi possível identificar o ID do novo registro após a criação.");
        }

    } catch (err) {
        console.error("Erro ao adicionar novo item:", err);
        alert("Falha ao criar o novo item: " + err.message);
    }
}


// Modifique a lógica dos filtros para habilitar o botão "Novo Item"
async function onContextoChange() {
    contextoSelecionadoId = parseInt(selectContexto.value, 10) || null;
    // Habilita o botão se um contexto for selecionado
    btnAbrirCopiador.disabled = !contextoSelecionadoId;
    btnNovoItem.disabled = !contextoSelecionadoId;
    await carregarPerguntas();
}


async function openDrawerForRecord(recordId) {
    editingRecordId = recordId;
    const record = estadoOriginalPerguntas.find(p => p.id === recordId);
    if (!record) {
        console.error("Registro para edição não encontrado:", recordId);
        return;
    }

    drawerTitleEl.textContent = `Editar Item #${recordId}`;

    // Declarando no escopo principal para que todas as sub-funções a acessem.
    const { allTables, allColumns } = _schemaCache;
    const perguntasTableMeta = allTables.find(t => t.tableId === 'Modelos_Perguntas');
    const perguntasColsMeta = allColumns.filter(c => String(c.parentId) === String(perguntasTableMeta.id));

    drawerContentEl.innerHTML = `
        <div class="form-group" data-types="all"><label for="drawer-texto">Texto</label><textarea id="drawer-texto" rows="3">${record.Texto_Pergunta || ''}</textarea></div>
        <div class="form-group" data-types="all"><label for="drawer-tipo">Tipo do Item</label><select id="drawer-tipo">${getOptions('Tipo_Item', record.Tipo_Item)}</select></div>
        <div class="form-group" data-types="Pergunta"><label for="drawer-detalhe">Detalhe da Pergunta</label><textarea id="drawer-detalhe" rows="4">${record.Detalhe_Pergunta || ''}</textarea></div>
        <div class="form-group" data-types="Pergunta"><label for="drawer-tipo-resposta">Tipo de Resposta Utilizado</label><select id="drawer-tipo-resposta"></select></div>
        <div class="form-group" data-types="Pergunta"><label for="drawer-id-calculo">ID para Cálculo</label><input type="text" id="drawer-id-calculo" value="${record.IDCalculo || ''}"></div>
        <div class="form-group" data-types="Secao"><label for="drawer-visibilidade-depende">Visibilidade Depende De</label><select id="drawer-visibilidade-depende"></select></div>
        <div class="form-group" data-types="Secao"><label for="drawer-visibilidade">Visibilidade - Valor</label><select id="drawer-visibilidade" multiple size="5" disabled></select><small>As opções aparecerão após selecionar o item acima.</small></div>
        <div class="form-group" data-types="Secao"><label for="drawer-repetivel">Repetível</label><select id="drawer-repetivel"><option value="">--</option>${getOptions('Repetivel', record.Repetivel)}</select></div>
        <div class="form-group" data-types="resultado_calculado"><label for="drawer-formula">Fórmula</label><textarea id="drawer-formula" rows="3">${record.Formula || ''}</textarea><div id="formula-helpers"><label>Variáveis disponíveis:</label><div id="formula-buttons-container"></div></div></div>
        <div class="form-group" data-types="resultado_calculado"><label for="drawer-faixa-calculo">Faixa de Cálculo</label><select id="drawer-faixa-calculo"></select></div>
    `;

    // --- LÓGICA DE POPULAÇÃO E EVENTOS ---
    const popPromises = [];
    popPromises.push(popularSelectDeReferencia(document.getElementById('drawer-tipo-resposta'), 'Tipos_Respostas_Grupos', record.Tipo_Resposta_Utilizado, 'Tipo_Resposta'));
    popPromises.push(popularSelectDeReferencia(document.getElementById('drawer-faixa-calculo'), 'IDsFaixas', record.FAIXA_CALCULADA, 'NomeFaixa'));
    
    const visibilidadeDependeSelect = document.getElementById('drawer-visibilidade-depende');
    visibilidadeDependeSelect.innerHTML = '<option value="0">-- Nenhum --</option>';
    estadoOriginalPerguntas.filter(item => item.id !== record.id && item.Tipo_Item === 'Pergunta').forEach(item => {
        visibilidadeDependeSelect.add(new Option(item.Texto_Pergunta, item.id, false, item.id === record.Visibilidade_DependeDe));
    });

    const visibilidadeValorSelect = document.getElementById('drawer-visibilidade');
    
    // CORREÇÃO: A função que filtra o Visibilidade - Valor
// Localize popularVisibilidadeValor dentro de openDrawerForRecord e substitua por isto:

// Localize popularVisibilidadeValor dentro de openDrawerForRecord e substitua por isto:

const popularVisibilidadeValor = async () => {
    const dependeDeId = parseInt(visibilidadeDependeSelect.value, 10);

    if (!dependeDeId) {
        visibilidadeValorSelect.innerHTML = '';
        visibilidadeValorSelect.disabled = true;
        return;
    }
    
    const perguntaPai = estadoOriginalPerguntas.find(p => p.id === dependeDeId);

    if (!perguntaPai || !perguntaPai.Tipo_Resposta_Utilizado) {
        visibilidadeValorSelect.innerHTML = '<option value="">-- A pergunta selecionada não tem opções de resposta --</option>';
        visibilidadeValorSelect.disabled = true;
        return;
    }
    
    const tipoRespostaGrupoId = perguntaPai.Tipo_Resposta_Utilizado;
    
    try {
        // PASSO 1: Busca a tabela 'Opcoes_Respostas_Detalhes' INTEIRA, SEM FILTRO.
        console.log("[DEBUG] Buscando a tabela 'Opcoes_Respostas_Detalhes' completa...");
        const todasAsOpcoes = await getTableData('Opcoes_Respostas_Detalhes');

        // PASSO 2: Filtra as opções AQUI, no JavaScript.
        const opcoesFiltradas = todasAsOpcoes.filter(opcao => 
            String(opcao.RefTiposRespostasGrupos) === String(tipoRespostaGrupoId)
        );
        
        console.log(`[DEBUG] Recebidas ${todasAsOpcoes.length} opções no total, ${opcoesFiltradas.length} após o filtro do cliente.`);
        
        // PASSO 3: Popula o select com os resultados filtrados.
        visibilidadeValorSelect.innerHTML = '';
        const valoresJaSelecionados = (record.Visibilidade_Valor || ['L']).slice(1);
        
        for (const opcao of opcoesFiltradas) {
            const option = new Option(opcao.Texto_Opcao, opcao.id, false, valoresJaSelecionados.includes(opcao.id));
            visibilidadeValorSelect.appendChild(option);
        }
        
        visibilidadeValorSelect.disabled = false;

    } catch (e) {
        console.error("FALHA na busca de dados de 'Opcoes_Respostas_Detalhes':", e);
        visibilidadeValorSelect.innerHTML = '<option>Erro ao carregar opções</option>';
        visibilidadeValorSelect.disabled = true;
    }
};

    visibilidadeDependeSelect.addEventListener('change', popularVisibilidadeValor);
    
    const formulaTextarea = document.getElementById('drawer-formula');
    const formulaButtonsContainer = document.getElementById('formula-buttons-container');
    const variaveis = estadoOriginalPerguntas.filter(p => p.IDCalculo && p.IDCalculo.trim() !== '').map(p => p.IDCalculo);
    variaveis.forEach(variavel => {
        const btn = document.createElement('button'); btn.textContent = variavel; btn.type = 'button'; btn.style.cssText = "padding: 2px 8px; font-family: monospace; cursor: pointer;";
        btn.onclick = () => {
            const pos = formulaTextarea.selectionStart; const text = formulaTextarea.value;
            formulaTextarea.value = text.slice(0, pos) + `[${variavel}]` + text.slice(pos);
            formulaTextarea.focus();
        };
        formulaButtonsContainer.appendChild(btn);
    });
    
    // CORREÇÃO: Lógica de visibilidade restaurada e funcional
    const tipoSelect = document.getElementById('drawer-tipo');
    const updateVisibility = () => {
        const tipo = tipoSelect.value.trim();
        document.querySelectorAll('.drawer-content .form-group[data-types]').forEach(group => {
            const types = group.dataset.types.split(',');
            if (types.includes(tipo) || types.includes('all')) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });
    };
    
    await Promise.all(popPromises);
    await popularVisibilidadeValor(); // Chamada inicial para popular
    
    tipoSelect.addEventListener('change', updateVisibility);
    updateVisibility(); // Chamada para definir o estado inicial

    drawerEl.classList.add('is-open');
    drawerOverlayEl.classList.add('is-open');
}


function closeDrawer() {
    drawerEl.classList.remove('is-open');
    drawerOverlayEl.classList.remove('is-open');
    editingRecordId = null;
}

async function saveDrawerChanges() {
    if (!editingRecordId) return;

    const tipo = document.getElementById('drawer-tipo').value;
    
    const updates = {
        Texto_Pergunta: document.getElementById('drawer-texto').value,
        Tipo_Item: tipo,
    };

    if (tipo === 'Pergunta') {
        updates.Detalhe_Pergunta = document.getElementById('drawer-detalhe').value;
        updates.Tipo_Resposta_Utilizado = parseInt(document.getElementById('drawer-tipo-resposta').value, 10) || 0;
        updates.IDCalculo = document.getElementById('drawer-id-calculo').value;
    }
    
    if (tipo === 'Secao') {
        const valoresSelecionados = Array.from(document.getElementById('drawer-visibilidade').selectedOptions).map(opt => parseInt(opt.value, 10));
        updates.Visibilidade_Valor = valoresSelecionados.length > 0 ? ['L', ...valoresSelecionados] : null;
        updates.Visibilidade_DependeDe = parseInt(document.getElementById('drawer-visibilidade-depende').value, 10) || 0;
        updates.Repetivel = document.getElementById('drawer-repetivel').value;
    }

    if (tipo === 'resultado_calculado') {
        updates.Formula = document.getElementById('drawer-formula').value;
        updates.FAIXA_CALCULADA = parseInt(document.getElementById('drawer-faixa-calculo').value, 10) || 0;
    }

    try {
        // 1. Envia a atualização para o Grist.
        await updateQuestions([{ id: editingRecordId, fields: updates }]);
        
        // 2. Fecha o drawer para o usuário ver a UI principal.
        closeDrawer();
        
        // 3. RECARREGA e RENDERIZA tudo com os dados mais recentes do Grist.
        //    Esta é a linha que corrige o problema de sincronização de estado.
        await carregarPerguntas();

    } catch(err) {
        alert("Falha ao salvar alterações: " + err.message);
    }
}

async function deleteRecordFromDrawer() {
    if (!editingRecordId) return;

    // A lógica recursiva original agora é segura porque o estado está sincronizado.
    const findAllDescendants = (parentId, allItems) => {
        let idsToDelete = [parentId];
        const directChildren = allItems.filter(item => item.ID_Pai === parentId);
        for (const child of directChildren) {
            idsToDelete = idsToDelete.concat(findAllDescendants(child.id, allItems));
        }
        return idsToDelete;
    };

    if (confirm(`Tem certeza que deseja EXCLUIR o item #${editingRecordId} e todos os seus sub-itens?`)) {
        try {
            const allIdsToDelete = findAllDescendants(editingRecordId, estadoOriginalPerguntas);
            if (allIdsToDelete.length > 0) {
                const removeActions = allIdsToDelete.map(id => ['RemoveRecord', 'Modelos_Perguntas', id]);
                await grist.docApi.applyUserActions(removeActions);
            }
            closeDrawer();
            await carregarPerguntas();
        } catch(err) {
            alert("Falha ao excluir item: " + err.message);
        }
    }
}

/**
 * Popula um elemento <select> com opções de uma tabela de referência.
 * @param {HTMLSelectElement} selectElement - O elemento select a ser populado.
 * @param {string} refTableId - O nome da tabela de referência.
 * @param {string|number} selectedId - O ID do item atualmente selecionado.
 */
async function popularSelectDeReferencia(selectElement, refTableId, selectedId, displayColId) {
    try {
        const records = await getTableData(refTableId);
        if (records.length === 0) {
            selectElement.innerHTML = '<option value="0">-- Nenhuma opção --</option>';
            return;
        }

        // Usa a coluna de display fornecida, com 'id' como fallback.
        const displayCol = records[0].hasOwnProperty(displayColId) ? displayColId : 'id';
        
        selectElement.innerHTML = '<option value="0">-- Nenhum --</option>';
        for (const record of records) {
            const option = document.createElement('option');
            option.value = record.id;
            option.textContent = record[displayCol] || `ID ${record.id}`;
            if (String(record.id) === String(selectedId)) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        }
    } catch (e) {
        console.error(`Falha ao popular select para a tabela ${refTableId}`, e);
        selectElement.innerHTML = `<option value="">Erro ao carregar</option>`;
    }
}


async function copiarMultiplasAreas(todasPerguntasDoModelo) {
    const areasSelecionadas = [];
    modalBody.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        areasSelecionadas.push({
            id: parseInt(cb.value, 10),
            texto: cb.dataset.areatexto
        });
    });

    if (areasSelecionadas.length === 0) {
        alert("Selecione pelo menos uma área para copiar.");
        return;
    }
    
    await executarCopia(areasSelecionadas, todasPerguntasDoModelo);
    fecharModalAreas();
}

// 4. FUNÇÃO CENTRAL DE EXECUÇÃO
async function executarCopia() {
    const auditoriaDestinoId = parseInt(copiadorSelectAuditoria.value, 10);
    if (!auditoriaDestinoId) {
        alert("Por favor, selecione uma auditoria de destino.");
        return;
    }

    let areasParaCopiar = [];
    if (copiadorCheckMultiplas.checked) {
        document.querySelectorAll('#areas-list-container .area-checkbox:checked').forEach(cb => {
            areasParaCopiar.push({ id: parseInt(cb.value, 10), texto: cb.dataset.areatexto });
        });
    } else {
        const areaId = parseInt(copiadorSelectAreaUnica.value, 10);
        if (areaId) {
            areasParaCopiar.push({ id: areaId, texto: copiadorSelectAreaUnica.options[copiadorSelectAreaUnica.selectedIndex].text });
        }
    }

    if (areasParaCopiar.length === 0) {
        alert("Selecione pelo menos uma área para copiar.");
        return;
    }
    
    // Agora que coletamos os dados, a lógica de salvamento começa aqui.
    // Isso substitui a chamada à função antiga.
    
    const areasTexto = areasParaCopiar.map(a => a.texto).join(', ');
    if (!confirm(`Copiar perguntas das áreas [${areasTexto}] para a auditoria selecionada?`)) {
        return;
    }

    modalCopiador.style.display = 'none'; // Fecha o modal
    btnAbrirCopiador.disabled = true;
    btnAbrirCopiador.textContent = 'Copiando...';
    
    try {
        const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
        const todasAsPerguntasDoModelo = await getTableData('Modelos_Perguntas', { Ref_Modelo_Mestre: [modeloMestreSelecionado.id] });
        
        const novosResultados = [];

        areasParaCopiar.forEach(area => {
            const perguntasParaEstaArea = todasAsPerguntasDoModelo.filter(p => String(p[colunaFiltro]) === String(area.id));
            
            perguntasParaEstaArea.forEach(pergunta => {
                novosResultados.push({
                    Auditoria: auditoriaDestinoId,
                    Pergunta: pergunta.id,
                    Referencia_Area: area.id,
                });
            });
        });

        if (novosResultados.length === 0) {
            throw new Error("Nenhuma pergunta correspondente encontrada para as áreas selecionadas.");
        }

        await grist.docApi.applyUserActions(
            novosResultados.map(r => ['AddRecord', 'Resultados', null, r])
        );
        alert(`${novosResultados.length} perguntas de ${areasParaCopiar.length} área(s) copiadas com sucesso!`);

    } catch (err) {
        console.error("Erro ao executar a cópia:", err);
        alert("Falha ao copiar o checklist: " + err.message);
    } finally {
        btnAbrirCopiador.disabled = false;
        btnAbrirCopiador.textContent = 'Copiar para Auditoria...';
    }
}

// E adicione esta função para fechar o modal
function fecharModalAreas() {
    modalAreas.style.display = 'none';
}

async function abrirModalClonador() {
    if (!modeloMestreSelecionado || !contextoSelecionadoId) {
        alert("Por favor, primeiro selecione um contexto para usar como origem.");
        return;
    }
    
    modalClonador.style.display = 'flex';
    document.getElementById('clonador-select-origem').style.display = 'none';
    clonadorSelectDestino.innerHTML = '<option value="">Carregando...</option>';

    try {
        const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
        const { contextRecords, displayColId } = await discoverContextInfo(colunaFiltro);
        const origemSelecionada = contextRecords.find(area => area.id === contextoSelecionadoId);
        const origemLabel = document.querySelector('label[for="clonador-select-origem"]');
        
        origemLabel.innerHTML = `Copiar de: <strong>${origemSelecionada[displayColId]}</strong>
            <div class="checkbox-group" style="margin-top: 10px;">
                <input type="checkbox" id="clonador-selecionar-itens">
                <label for="clonador-selecionar-itens">Selecionar Itens Específicos</label>
            </div>
        `;
        
        clonadorSelectDestino.innerHTML = '';
        contextRecords.forEach(area => {
            // Agora adicionamos TODAS as áreas à lista de destinos, incluindo a de origem.
            clonadorSelectDestino.add(new Option(area[displayColId], area.id));
        });
        
        // ==========================================================
        // CORREÇÃO DA LÓGICA DO BOTÃO
        // ==========================================================
        clonadorConfirmBtn.onclick = () => {
            const destinosIds = Array.from(clonadorSelectDestino.selectedOptions).map(opt => parseInt(opt.value, 10));
            const selecionarItens = document.getElementById('clonador-selecionar-itens').checked;

            if (destinosIds.length === 0) {
                alert("Por favor, selecione pelo menos um contexto de destino.");
                return;
            }

            if (selecionarItens) {
                // Chama a função que entra no modo de seleção
                iniciarModoSelecao(contextoSelecionadoId, destinosIds);
            } else {
                // Chama a função que executa a clonagem total
                executarClonagem(contextoSelecionadoId, destinosIds, null);
            }
        };
        // ==========================================================

    } catch (e) {
        console.error("Erro ao popular modal de clonagem:", e);
        // Tratar erro
    }
}




// Substitua esta função inteira no seu arquivo modaud_main.js original

// Substitua esta função inteira no seu arquivo modaud_main.js original

// Substitua esta função inteira no seu arquivo modaud_main.js original

// Substitua esta função inteira no seu arquivo modaud_main.js original

// Substitua esta função inteira no seu arquivo modaud_main.js original

async function executarClonagem(origemId, destinosIds, idsParaClonar = null) {
    if (!origemId || !destinosIds || destinosIds.length === 0) {
        alert("Por favor, selecione um contexto de origem e pelo menos um de destino.");
        return;
    }

    const itemText = idsParaClonar ? `${idsParaClonar.length} itens selecionados` : "todas as perguntas";
    if (!confirm(`Isso criará uma cópia de ${itemText} para os destinos selecionados. Deseja continuar?`)) {
        return;
    }

    modalClonador.style.display = 'none';

    try {
        btnAbrirClonador.disabled = true;
        btnAbrirClonador.textContent = 'Clonando...';
        
        const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
        if (!colunaFiltro) {
            throw new Error("Não foi possível determinar a 'Coluna_Filtro_Perguntas' a partir do Modelo Mestre.");
        }

        const todasAsPerguntasDoModelo = await getTableData('Modelos_Perguntas', { Ref_Modelo_Mestre: [modeloMestreSelecionado.id] });
        let perguntasOrigem = todasAsPerguntasDoModelo.filter(p => String(p[colunaFiltro]) === String(origemId));
        if (idsParaClonar && idsParaClonar.length > 0) {
            const idSet = new Set(idsParaClonar);
            perguntasOrigem = perguntasOrigem.filter(p => idSet.has(p.id));
        }
        
        if (perguntasOrigem.length === 0) {
            alert("O contexto de origem (ou sua seleção) não tem perguntas para clonar.");
            return;
        }
        
        const { allColumns, allTables } = _schemaCache;
        const perguntasTableMeta = allTables.find(t => t.tableId === 'Modelos_Perguntas');
        const colunasMeta = allColumns.filter(c => String(c.parentId) === String(perguntasTableMeta.id));
        const colunasParaCopiar = colunasMeta
            .filter(c => !c.isFormula && c.colId !== 'id' && c.colId !== 'manualSort')
            .map(c => c.colId);

        for (const destinoId of destinosIds) {
            // PASSO 1 (Antes): Obter todos os IDs existentes no destino ANTES da operação.
            const idsAntesDaCopia = new Set(
                todasAsPerguntasDoModelo
                    .filter(p => String(p[colunaFiltro]) === String(destinoId))
                    .map(p => p.id)
            );

            // PASSO 2 (Ação): Preparar e enviar um único lote de criação.
            const acoesAdicionar = [];
            perguntasOrigem.forEach(pOrigem => {
                const novaPergunta = {};
                for (const colId of colunasParaCopiar) {
                    if (colId !== 'ID_Pai' && colId !== 'Visibilidade_DependeDe') {
                        novaPergunta[colId] = pOrigem[colId];
                    }
                }
                novaPergunta[colunaFiltro] = destinoId;
                acoesAdicionar.push(['AddRecord', 'Modelos_Perguntas', null, novaPergunta]);
            });

            await grist.docApi.applyUserActions(acoesAdicionar);

            // PASSO 3 (Depois): Rebuscar todos os dados para obter o novo estado.
            const perguntasDepoisDaCopia = await getTableData('Modelos_Perguntas', { Ref_Modelo_Mestre: [modeloMestreSelecionado.id] });

            // PASSO 4 (Mapeamento): Isolar os novos IDs e construir o mapa.
            const novosIdsEncontrados = perguntasDepoisDaCopia
                .filter(p => String(p[colunaFiltro]) === String(destinoId) && !idsAntesDaCopia.has(p.id))
                .map(p => p.id);

            const mapaIds = new Map();
            if (novosIdsEncontrados.length === perguntasOrigem.length) {
                perguntasOrigem.forEach((pOrigem, index) => {
                    mapaIds.set(pOrigem.id, novosIdsEncontrados[index]);
                });
            } else {
                throw new Error("A contagem de novos registros não corresponde à contagem de origem. A clonagem foi abortada para evitar dados corrompidos.");
            }

            // PASSO 5 (Atualização): Com o mapa correto, atualizar os relacionamentos.
            const acoesAtualizar = [];
            perguntasOrigem.forEach((pOrigem) => {
                const idNovo = mapaIds.get(pOrigem.id);
                if (!idNovo) return;

                const updates = {};
                let precisaAtualizar = false;

                const oldParentId = pOrigem.ID_Pai;
                if (oldParentId && mapaIds.has(oldParentId)) {
                    updates.ID_Pai = mapaIds.get(oldParentId);
                    precisaAtualizar = true;
                }

                const oldVisibilidadeId = pOrigem.Visibilidade_DependeDe;
                if (oldVisibilidadeId && mapaIds.has(oldVisibilidadeId)) {
                    updates.Visibilidade_DependeDe = mapaIds.get(oldVisibilidadeId);
                    precisaAtualizar = true;
                }
                
                if (precisaAtualizar) {
                    acoesAtualizar.push(['UpdateRecord', 'Modelos_Perguntas', idNovo, updates]);
                }
            });
            
            if (acoesAtualizar.length > 0) {
                await grist.docApi.applyUserActions(acoesAtualizar);
            }
        }

        alert("Clonagem concluída com sucesso!");
        
        if (destinosIds.includes(parseInt(contextoSelecionadoId,10))) {
            await carregarPerguntas();
        }

    } catch (err) {
        console.error("Erro durante a clonagem:", err);
        alert("Falha ao clonar: " + err.message);
    } finally {
        btnAbrirClonador.disabled = false;
        btnAbrirClonador.textContent = 'Clonar Contexto...';
    }
}

async function abrirModalCopiador() {
    if (!modeloMestreSelecionado || !contextoSelecionadoId) return;
    
    modalCopiador.style.display = 'flex';
    copiadorSelectAuditoria.innerHTML = '<option>Carregando...</option>';
    copiadorSelectAreaUnica.innerHTML = '<option>Carregando...</option>';
    copiadorAreasMultiplasContainer.innerHTML = '';
    
    // Inicia a busca por auditorias e áreas ao mesmo tempo
    try {
        const [auditorias, areasDoModelo] = await Promise.all([
            getTableData('Auditoria'),
            getAllAreasForCurrentModel()
        ]);
        
        // Popula o dropdown de auditorias
        copiadorSelectAuditoria.innerHTML = '<option value="">-- Selecione uma Auditoria --</option>';
        auditorias.forEach(auditoria => {
            copiadorSelectAuditoria.add(new Option(auditoria.IdAud, auditoria.id));
        });

        // Popula os seletores de área (única e múltipla)
        copiadorSelectAreaUnica.innerHTML = '';
        copiadorAreasMultiplasContainer.innerHTML = `
            <div class="modal-area-item select-all-container">
                <input type="checkbox" id="check-select-all-areas">
                <label for="check-select-all-areas"><strong>Selecionar/Desselecionar Todos</strong></label>
            </div>
            <div id="areas-list-container"></div>`;
            
        const listContainer = document.getElementById('areas-list-container');
        areasDoModelo.forEach(area => {
            // Para o dropdown de área única
            const isSelected = area.id === contextoSelecionadoId;
            copiadorSelectAreaUnica.add(new Option(area.texto, area.id, false, isSelected));

            // Para a lista de múltiplas áreas
            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-area-item';
            itemDiv.innerHTML = `<input type="checkbox" class="area-checkbox" id="area-${area.id}" value="${area.id}" data-areatexto="${area.texto}" ${isSelected ? 'checked' : ''}><label for="area-${area.id}">${area.texto}</label><span class="count">(${area.count}p)</span>`;
            listContainer.appendChild(itemDiv);
        });

        // Adiciona listener para o "Selecionar Todos"
        document.getElementById('check-select-all-areas').addEventListener('change', e => {
            listContainer.querySelectorAll('.area-checkbox').forEach(cb => cb.checked = e.target.checked);
        });

        // Define o estado inicial da UI do modal
        copiadorCheckMultiplas.checked = false;
        alternarModoCopia();

    } catch (e) {
        console.error("Erro ao abrir modal de cópia:", e);
    }
}

// Controla qual seletor de área (único ou múltiplo) é exibido
function alternarModoCopia() {
    if (copiadorCheckMultiplas.checked) {
        copiadorAreaUnicaContainer.style.display = 'none';
        copiadorAreasMultiplasContainer.style.display = 'block';
    } else {
        copiadorAreaUnicaContainer.style.display = 'block';
        copiadorAreasMultiplasContainer.style.display = 'none';
    }
}

// Função auxiliar para buscar todas as áreas e contar as perguntas em um modelo
async function getAllAreasForCurrentModel() {
    const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
    const { contextRecords: areas, displayColId } = await discoverContextInfo(colunaFiltro);
    const todasPerguntas = await getTableData('Modelos_Perguntas', { Ref_Modelo_Mestre: [modeloMestreSelecionado.id] });
    
    return areas
        .map(area => ({
            id: area.id,
            texto: area[displayColId],
            count: todasPerguntas.filter(p => String(p[colunaFiltro]) === String(area.id)).length
        }))
        .filter(area => area.count > 0); // Só retorna áreas que têm perguntas
}

function iniciarModoSelecao(origemId, destinosIds) {
    modalClonador.style.display = 'none';
    document.body.classList.add('selection-mode');

    // Desabilita drag-and-drop para permitir cliques
    sortableInstances.forEach(s => s.option("disabled", true));

    // Esconde os botões normais e cria os botões de confirmação/cancelamento
    const headerButtons = document.querySelector('.header-buttons');
    headerButtons.querySelectorAll('button').forEach(btn => btn.style.display = 'none');
    
    const btnConfirmar = document.createElement('button');
    btnConfirmar.id = 'btn-confirmar-clone';
    btnConfirmar.textContent = 'Confirmar e Clonar Itens';
    
    const btnCancelar = document.createElement('button');
    btnCancelar.id = 'btn-cancelar-clone';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.className = 'secondary';

    headerButtons.prepend(btnCancelar);
    headerButtons.prepend(btnConfirmar);

    // Lógica de cancelamento
    btnCancelar.onclick = sairModoSelecao;

    // Lógica de confirmação
    btnConfirmar.onclick = () => {
        const selectedIds = new Set();
        containerPerguntas.querySelectorAll('.pergunta-card.selected').forEach(card => {
            selectedIds.add(parseInt(card.dataset.id, 10));
        });

        if (selectedIds.size === 0) {
            alert("Nenhum item foi selecionado.");
            return;
        }
        
        executarClonagem(origemId, destinosIds, Array.from(selectedIds));
        sairModoSelecao();
    };

    // Adiciona o evento de clique nos cards
    containerPerguntas.querySelectorAll('.pergunta-card').forEach(card => {
        card.addEventListener('click', toggleSelecaoItem);
    });
}

function sairModoSelecao() {
    document.body.classList.remove('selection-mode');
    
    // Habilita drag-and-drop novamente
    sortableInstances.forEach(s => s.option("disabled", false));
    
    // Restaura os botões originais
    const headerButtons = document.querySelector('.header-buttons');
    headerButtons.querySelectorAll('button').forEach(btn => btn.style.display = ''); // Mostra os botões originais
    
    // Remove os botões temporários
    document.getElementById('btn-confirmar-clone')?.remove();
    document.getElementById('btn-cancelar-clone')?.remove();

    // Remove os listeners de clique e a classe 'selected' dos cards
    containerPerguntas.querySelectorAll('.pergunta-card').forEach(card => {
        card.removeEventListener('click', toggleSelecaoItem);
        card.classList.remove('selected');
    });
}

function toggleSelecaoItem(event) {
    // Impede que o clique no botão de edição/add acione a seleção
    if (event.target.closest('button')) {
        return;
    }

    const card = event.currentTarget;
    const isSelected = card.classList.toggle('selected');
    
    // Lógica de seleção em cascata para os filhos
    const wrapper = card.closest('.card-wrapper');
    const subContainer = wrapper.querySelector('.sub-perguntas-container');
    if (subContainer) {
        subContainer.querySelectorAll('.pergunta-card').forEach(childCard => {
            childCard.classList.toggle('selected', isSelected);
        });
    }
}

async function salvarAlteracoes() {
    const btnSalvar = document.getElementById('btn-salvar');
    if (!btnSalvar) return;

    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';

    const updates = [];
    const estadoAtualMap = new Map();
    
    // Percorre todos os wrappers para manter a estrutura correta
    function analisarEstrutura(container, parentId) {
        const children = Array.from(container.children).filter(el => el.classList.contains('card-wrapper'));
        children.forEach((wrapper, index) => {
            const card = wrapper.querySelector('.pergunta-card');
            if (!card) return;

            const recordId = parseInt(card.dataset.id, 10);
            const novaOrdem = index;
            
            estadoAtualMap.set(recordId, { ID_Pai: parentId, Ordem: novaOrdem });

            // Analisa os filhos deste item recursivamente
            const subContainer = wrapper.querySelector('.sub-perguntas-container');
            if (subContainer) {
                analisarEstrutura(subContainer, recordId);
            }
        });
    }

    analisarEstrutura(containerPerguntas, 0); // Começa na raiz

    // Compara o estado original com o atual para encontrar mudanças
    for (const originalRecord of estadoOriginalPerguntas) {
        const estadoAtual = estadoAtualMap.get(originalRecord.id);
        if (estadoAtual) {
            const mudouPai = (originalRecord.ID_Pai || 0) !== estadoAtual.ID_Pai;
            const mudouOrdem = (originalRecord.Ordem || 0) !== estadoAtual.Ordem;
            
            if (mudouPai || mudouOrdem) {
                updates.push({
                    id: originalRecord.id,
                    fields: {
                        ID_Pai: estadoAtual.ID_Pai,
                        Ordem: estadoAtual.Ordem
                    }
                });
            }
        }
    }

    if (updates.length === 0) {
        alert("Nenhuma alteração de ordem ou hierarquia para salvar.");
        btnSalvar.textContent = 'Salvar Alterações';
        return;
    }

    try {
        await updateQuestions(updates);
        alert('Alterações de ordem e hierarquia salvas com sucesso!');
        await carregarPerguntas(); // Recarrega para refletir o estado salvo
    } catch (err) {
        alert(`Falha ao salvar: ${err.message}`);
        btnSalvar.disabled = false; // Reabilita em caso de erro
    } finally {
        btnSalvar.textContent = 'Salvar Alterações';
    }
}