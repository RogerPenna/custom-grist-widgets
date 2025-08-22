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

// Estado da Aplicação
let todosModelosMestres = [];
let modeloMestreSelecionado = null;
let contextoSelecionadoId = null;
let estadoOriginalPerguntas = [];
let sortableInstances = [];
let _schemaCache = { allTables: null, allColumns: null };

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

async function onContextoChange() {
    contextoSelecionadoId = parseInt(selectContexto.value, 10) || null;
    await carregarPerguntas();
}

function resetarContextoEPerguntas() {
    labelContexto.textContent = "Contexto:";
    selectContexto.innerHTML = '<option value="">-- Selecione --</option>';
    selectContexto.disabled = true;
    containerPerguntas.innerHTML = '<p>Selecione um Modelo e um Contexto para começar.</p>';
    btnSalvar.disabled = true;
    estadoOriginalPerguntas = [];
}

async function carregarPerguntas() {
    if (!modeloMestreSelecionado) return;
    containerPerguntas.innerHTML = '<p>Carregando perguntas...</p>';
    btnSalvar.disabled = true;

    // ----- INÍCIO DA MUDANÇA DE LÓGICA -----
    const modeloMestreId = modeloMestreSelecionado.id;
    const colunaFiltro = modeloMestreSelecionado.Coluna_Filtro_Perguntas;
    
    // Verificação inicial
    if (colunaFiltro && !contextoSelecionadoId) {
        containerPerguntas.innerHTML = `<p>Selecione um contexto para ver as perguntas.</p>`;
        return;
    }
    
    try {
        // PASSO 1: Busca TODAS as perguntas que pertencem ao Modelo Mestre.
        // Este filtro de alto nível é mais provável de funcionar na API.
        const filtroMestre = { Ref_Modelo_Mestre: [modeloMestreId] };
        console.log("[DEBUG] Buscando todas as perguntas para o modelo mestre com filtro:", filtroMestre);
        const todasAsPerguntasDoModelo = await getTableData('Modelos_Perguntas', filtroMestre);
        console.log(`[DEBUG] API retornou ${todasAsPerguntasDoModelo.length} perguntas para o modelo mestre.`);

        // PASSO 2: Aplicamos o filtro de contexto AQUI, no lado do cliente.
        let perguntasFiltradas = todasAsPerguntasDoModelo;

        if (colunaFiltro && contextoSelecionadoId) {
            console.log(`[DEBUG] Aplicando filtro de cliente: ${colunaFiltro} === ${contextoSelecionadoId}`);
            perguntasFiltradas = todasAsPerguntasDoModelo.filter(pergunta => {
                // A comparação precisa ser flexível (string vs número)
                return String(pergunta[colunaFiltro]) === String(contextoSelecionadoId);
            });
        }
        
        console.log(`[DEBUG] Após filtro de cliente, restaram ${perguntasFiltradas.length} perguntas.`);
        
        // PASSO 3: Renderiza apenas as perguntas filtradas.
        estadoOriginalPerguntas = JSON.parse(JSON.stringify(perguntasFiltradas));
        renderizarPerguntas(containerPerguntas, perguntasFiltradas);
        configurarSortable();
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