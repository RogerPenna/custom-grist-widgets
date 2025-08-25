// js/modaud_main.js

import { getTableData, updateQuestions } from './modaud_grist.js';
import { renderizarPerguntas } from './modaud_ui.js';

// ---- CONSTANTES E ESTADO ----
const TABELA_MESTRES = 'Modelos_Auditoria_Mestres';

// Elementos do DOM
const selectModeloMestre = document.getElementById('select-modelo-mestre');
const selectContexto = document.getElementById('select-contexto');
const labelContexto = document.getElementById('label-contexto');
const containerPerguntas = document.getElementById('lista-perguntas');
const btnSalvar = document.getElementById('btn-salvar');
const btnNovoItem = document.getElementById('btn-novo-item');
const drawerEl = document.getElementById('drawer');
const drawerOverlayEl = document.getElementById('drawer-overlay');
const drawerTitleEl = document.getElementById('drawer-title');
const drawerContentEl = document.getElementById('drawer-content');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerSaveBtn = document.getElementById('drawer-save-btn');
const drawerDeleteBtn = document.getElementById('drawer-delete-btn');
let editingRecordId = null;

// Estado da Aplicação
let todosModelosMestres = [];
let modeloMestreSelecionado = null;
let contextoSelecionadoId = null;
let estadoOriginalPerguntas = [];
let sortableInstances = [];
let _schemaCache = { allTables: null, allColumns: null };

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
        
        selectModeloMestre.addEventListener('change', onModeloMestreChange);
        selectContexto.addEventListener('change', onContextoChange);
        btnSalvar.addEventListener('click', salvarAlteracoes);
        
        // CORREÇÃO: Chama a função 'criarNovoItem' sem passar o objeto de evento.
        // O valor padrão parentId=0 será usado, que é o correto para este botão.
        btnNovoItem.addEventListener('click', () => criarNovoItem());

        drawerCloseBtn.addEventListener('click', closeDrawer);
        drawerOverlayEl.addEventListener('click', closeDrawer);
        drawerSaveBtn.addEventListener('click', saveDrawerChanges);
        drawerDeleteBtn.addEventListener('click', deleteRecordFromDrawer);

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
	btnNovoItem.disabled = true;
    estadoOriginalPerguntas = [];
}

async function carregarPerguntas() {
    if (!modeloMestreSelecionado) return;
    containerPerguntas.innerHTML = '<p>Carregando perguntas...</p>';
    btnSalvar.disabled = true;

    const modeloMestreId = modeloMestreSelecionado.id;
    const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;

    if (colunaFiltro && !contextoSelecionadoId) {
        containerPerguntas.innerHTML = `<p>Selecione um contexto para ver as perguntas.</p>`;
        return;
    }

    try {
        // PASSO 1: Busca TODAS as perguntas que pertencem ao Modelo Mestre.
        const filtroMestre = { Ref_Modelo_Mestre: [modeloMestreId] };
        const todasAsPerguntasDoModelo = await getTableData('Modelos_Perguntas', filtroMestre);

        // PASSO 2: Aplicamos o filtro de contexto AQUI, no lado do cliente.
        let perguntasFiltradas = todasAsPerguntasDoModelo;
        if (colunaFiltro && contextoSelecionadoId) {
            perguntasFiltradas = todasAsPerguntasDoModelo.filter(p => String(p[colunaFiltro]) === String(contextoSelecionadoId));
        }
        
        console.log(`[DEBUG] Recebidas ${perguntasFiltradas.length} perguntas após o filtro do cliente.`);
        
        estadoOriginalPerguntas = JSON.parse(JSON.stringify(perguntasFiltradas));
        
        renderizarPerguntas(containerPerguntas, perguntasFiltradas);
        configurarSortable();

        // Conecta o listener para o botão de edição (engrenagem)
        containerPerguntas.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.pergunta-card');
                const recordId = parseInt(card.dataset.id, 10);
                openDrawerForRecord(recordId);
            });
        });

        // Conecta os listeners para os botões "+" de adicionar filho
        containerPerguntas.querySelectorAll('.add-child-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parentId = parseInt(e.target.closest('.pergunta-card').dataset.id, 10);
                criarNovoItem(parentId); // Não passa o evento 'e'
            });
        });

        // Conecta os listeners para os botões "+" de adicionar irmão
        containerPerguntas.querySelectorAll('.add-sibling-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parentContainer = e.target.closest('.sortable-list');
                const parentId = parseInt(parentContainer.dataset.parentId, 10) || 0;
                criarNovoItem(parentId); // Não passa o evento 'e'
            });
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
        sortableInstances.push(new Sortable(container, {
            group: 'perguntas', animation: 150, handle: '.drag-handle', onEnd: () => { btnSalvar.disabled = false; }
        }));
    });
}

async function salvarAlteracoes() {
    btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...';
    const updates = []; const estadoAtualMap = new Map();
    document.querySelectorAll('.pergunta-card').forEach(card => {
        const recordId = parseInt(card.dataset.id, 10);
        const parentContainer = card.closest('.sortable-list');
        const novoPaiId = parseInt(parentContainer.dataset.parentId, 10) || 0;
        const siblings = Array.from(parentContainer.children).filter(el => el.classList.contains('pergunta-card'));
        const novaOrdem = siblings.indexOf(card);
        estadoAtualMap.set(recordId, { ID_Pai: novoPaiId, Ordem: novaOrdem });
    });
    for (const originalRecord of estadoOriginalPerguntas) {
        const estadoAtual = estadoAtualMap.get(originalRecord.id);
        if (estadoAtual) {
            const mudouPai = (originalRecord.ID_Pai || 0) !== estadoAtual.ID_Pai;
            const mudouOrdem = (originalRecord.Ordem || 0) !== estadoAtual.Ordem;
            if (mudouPai || mudouOrdem) { updates.push({ id: originalRecord.id, fields: { ID_Pai: estadoAtual.ID_Pai, Ordem: estadoAtual.Ordem } }); }
        }
    }
    if (updates.length === 0) { alert("Nenhuma alteração para salvar."); btnSalvar.textContent = 'Salvar Alterações'; return; }
    try { 
        await updateQuestions(updates); 
        alert('Alterações salvas com sucesso!'); 
        await carregarPerguntas(); 
    } catch (err) { 
        alert(`Falha ao salvar: ${err.message}`); 
        btnSalvar.disabled = false; 
    } finally { 
        btnSalvar.textContent = 'Salvar Alterações'; 
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
        await updateQuestions([{ id: editingRecordId, fields: updates }]);
        closeDrawer();
        await carregarPerguntas();
    } catch(err) {
        alert("Falha ao salvar alterações: " + err.message);
    }
}

async function deleteRecordFromDrawer() {
    if (!editingRecordId) return;

    if (confirm(`Tem certeza que deseja EXCLUIR o item #${editingRecordId} e todos os seus sub-itens? Esta ação não pode ser desfeita.`)) {
        try {
            // Nota: Excluir um pai no Grist não exclui os filhos automaticamente.
            // Esta é uma simplificação. Uma versão completa precisaria encontrar e excluir todos os filhos recursivamente.
            await grist.docApi.removeRecords('Modelos_Perguntas', [editingRecordId]);
            closeDrawer();
            await carregarPerguntas(); // Força o recarregamento
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