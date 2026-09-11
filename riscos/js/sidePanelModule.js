// js/sidePanelModule.js
import { fetchAllAnalyses, filterAnalysesForRisk, findAnalysisLinkingColumn } from './gristApiService.js';
import { formatDate, getDeptName } from './utils.js';
import { getColumnKey } from './config.js';

const panelElement = document.getElementById('side-panel');
const titleElement = document.getElementById('side-panel-title');
const tabContentsElement = panelElement?.querySelectorAll('.tab-content');
const tabButtonsElement = panelElement?.querySelectorAll('.tab-button');
const closeButton = document.getElementById('btn-close-side-panel');

let currentRiskData = null; // Guarda os dados do risco selecionado
let currentActiveTab = 'detalhes'; // Estado da aba ativa

// --- Getters Dinâmicos de Colunas ---
const getColIdRisco = () => getColumnKey('IDRisco', 'idRiscoField');
const getColNomeRisco = () => getColumnKey('NomeRisco', 'nomeRiscoField');
const getColDepto = () => getColumnKey('Departamento', 'deptoField');
const getColProb = () => getColumnKey('ultprob', 'probField');
const getColImpact = () => getColumnKey('ultimpac', 'impactField');
const getColTratamento = () => getColumnKey('Ultimo_Tratamento', 'tratamentoField');
const getColPAs = () => getColumnKey('PAs', 'pasField');
const getColNextAnalise = () => getColumnKey('DataProxAnalise', 'nextAnaliseField');
const getColDescricao = () => getColumnKey('Descricao', 'descricaoField');

// For analyses columns:
const getColAnalysisProb = () => getColumnKey('ProbNum', 'analysisProbField');
const getColAnalysisImpact = () => getColumnKey('ImpactNum', 'analysisImpactField');
const getColAnalysisDate = () => getColumnKey('Data_Analise', 'analysisDateField');

/** Inicializa o módulo do painel lateral, adicionando listeners. */
export function initSidePanel() {
    if (!panelElement) {
        console.error("Elemento do painel lateral não encontrado.");
        return;
    }
    // Listener para fechar painel
    closeButton?.addEventListener('click', closeSidePanel);

    // Listeners para botões das abas
    tabButtonsElement?.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            activateTab(tabName);
        });
    });
}

/** Abre e configura o painel lateral para um risco específico. */
export function openSidePanel(riskRecord) {
    if (!panelElement || !riskRecord) return;
    console.log("Abrindo painel para Risco ID:", riskRecord.id);

    currentRiskData = riskRecord;
    if (titleElement) {
        const cod = riskRecord[getColIdRisco()] || riskRecord.id;
        const codDisplay = !isNaN(cod) ? `RSK-${String(cod).padStart(4, '0')}` : cod;
        titleElement.textContent = `Detalhes: ${codDisplay} - ${riskRecord[getColNomeRisco()] || 'Sem Nome'}`;
    }

    // Renderiza detalhes imediatamente
    renderRiskDetails();
    
    // Limpa/reseta outras abas
    const analysesTab = document.getElementById('tab-analises');
    if (analysesTab) analysesTab.innerHTML = '<p class="loading-message">Clique para carregar análises.</p>';

    const evolucaoTab = document.getElementById('tab-evolucao');
    if (evolucaoTab) evolucaoTab.innerHTML = '<div id="drawer-matrix-container"><p class="loading-message">Clique para carregar evolução.</p></div>';

    // Abre o painel aplicando a classe CSS active para transição suave
    panelElement.classList.add('active');
    currentActiveTab = ''; // Força ativação
    activateTab('detalhes'); // Garante que detalhes é a aba ativa inicial
}

/** Fecha o painel lateral. */
export function closeSidePanel() {
    if (!panelElement) return;
    panelElement.classList.remove('active'); // Remove classe active para transição de fechar
    currentRiskData = null; // Limpa o risco atual
    currentActiveTab = 'detalhes'; // Reseta aba ativa
    console.log("Painel lateral fechado.");
}

/** Ativa uma aba específica. */
async function activateTab(tabName) {
    if (!panelElement || currentActiveTab === tabName) return; // Não faz nada se já está ativa

    console.log(`Ativando aba: ${tabName}`);
    currentActiveTab = tabName;

    // Atualiza classes 'active' nos botões e conteúdos
    tabButtonsElement?.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    tabContentsElement?.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Lógica específica ao ativar certas abas
    if (tabName === 'analises' && currentRiskData) {
        await loadAndRenderAnalyses();
    } else if (tabName === 'evolucao' && currentRiskData) {
        await loadAndRenderEvolution();
    }
}

/** Renderiza a evolução individual do risco na matriz modular do drawer */
async function loadAndRenderEvolution() {
    const container = document.getElementById('tab-evolucao');
    if (!container || !currentRiskData) return;

    container.innerHTML = `
        <div id="drawer-matrix-container" style="width:100%; height:100%; display:flex; flex-direction:column;">
            <p class="loading-message"><em>Carregando matriz de evolução...</em></p>
        </div>
    `;

    try {
        await findAnalysisLinkingColumn();
        await fetchAllAnalyses();
        const relatedAnalyses = filterAnalysesForRisk(currentRiskData.id);

        const { renderMatrix } = await import('./matrixModule.js');
        
        renderMatrix(
            null, // sem registros gerais (foca apenas na evolução individual)
            'drawer-matrix-container',
            null,
            null,
            null,
            currentRiskData, // risco selecionado
            relatedAnalyses // análises vinculadas
        );
    } catch (e) {
        console.error("Erro ao renderizar evolução no drawer:", e);
        container.innerHTML = `<p style="color: var(--danger); padding: 12px;">Erro ao carregar evolução: ${e.message}</p>`;
    }
}

/** Renderiza os detalhes do risco atual na aba 'detalhes'. */
function renderRiskDetails() {
    const container = document.getElementById('tab-detalhes');
    if (!container) return;
    if (!currentRiskData) {
        container.innerHTML = '<p>Erro: Dados do risco não disponíveis.</p>';
        return;
    }
    
    const cod = currentRiskData[getColIdRisco()] || currentRiskData.id;
    const codDisplay = !isNaN(cod) ? `RSK-${String(cod).padStart(4, '0')}` : cod;

    // Obtém o grau de risco atual em formato de texto/choice list
    const grau = currentRiskData["$Grau_de_Risco_Atual"]?.[1] || currentRiskData.Grau_de_Risco_Atual || currentRiskData.UltimoCalcRisk || 'N/A';

    container.innerHTML = `
        <h3>${currentRiskData[getColNomeRisco()] || "Sem nome"} (#${codDisplay})</h3>
        <p><strong>Departamento:</strong> ${getDeptName(currentRiskData, getColDepto())}</p>
        <p><strong>Descrição:</strong> ${currentRiskData[getColDescricao()] || currentRiskData.Descricao || "<em>Não fornecida</em>"}</p>
        <hr>
        <p><strong>Última Probabilidade:</strong> ${currentRiskData.UltimaProbabilidade || currentRiskData[getColProb()] || "N/D"}</p>
        <p><strong>Último Impacto:</strong> ${currentRiskData.Ultimo_Impacto || currentRiskData[getColImpact()] || "N/D"}</p>
        <p><strong>Grau de Risco Atual:</strong> ${grau}</p>
        <p><strong>Tratamento Atual:</strong> ${currentRiskData[getColTratamento()] || currentRiskData.Tratamento || "N/D"}</p>
        <p><strong>Planos de Ação:</strong> ${currentRiskData[getColPAs()] || currentRiskData.PAs || '0'}</p>
        <p><strong>Próxima Análise:</strong> ${formatDate(currentRiskData[getColNextAnalise()]) || formatDate(currentRiskData.DataProxAnalise) || "<em>Não definida</em>"}</p>
    `;
}

/** Carrega (se necessário) e renderiza as análises para o risco atual. */
async function loadAndRenderAnalyses() {
    const container = document.getElementById('tab-analises');
    if (!container || !currentRiskData) return;

    container.innerHTML = '<p class="loading-message"><em>Carregando análises...</em></p>';
    try {
        await findAnalysisLinkingColumn(); // Garante identificação da coluna de ligação
        await fetchAllAnalyses();          // Garante busca das análises
        const relatedAnalyses = filterAnalysesForRisk(currentRiskData.id);
        renderRiskAnalyses(relatedAnalyses);
    } catch (error) {
        console.error("Erro ao carregar/renderizar análises:", error);
        container.innerHTML = `<p style="color: var(--danger);">Erro ao carregar análises: ${error.message}</p>`;
    }
}

/** Renderiza a lista de análises filtradas. */
function renderRiskAnalyses(analyses) {
    const container = document.getElementById('tab-analises');
    if (!container) return;

    if (!analyses || analyses.length === 0) {
        container.innerHTML = "<p>Nenhuma análise encontrada para este risco.</p>";
        return;
    }

    // Ordena análises por data decrescente (mais recente primeiro)
    analyses.sort((a, b) => {
        const dateValA = a[getColAnalysisDate()] || a.DataAnalise || 0;
        const dateValB = b[getColAnalysisDate()] || b.DataAnalise || 0;
        const timeA = typeof dateValA === 'number' ? dateValA * 1000 : new Date(dateValA).getTime();
        const timeB = typeof dateValB === 'number' ? dateValB * 1000 : new Date(dateValB).getTime();
        return timeB - timeA;
    });

    let html = '<ul>';
    analyses.forEach(a => {
        const dateVal = a[getColAnalysisDate()] || a.DataAnalise;
        const formattedDate = formatDate(dateVal) || 'N/D';
        const prob = a[getColAnalysisProb()] || a.ProbNum || a.Probabilidade || 'N/D';
        const imp = a[getColAnalysisImpact()] || a.ImpactNum || a.Consequencia || 'N/D';
        const grau = a.Grau_de_Risco?.[1] || a.Grau_de_Risco || a.CalcRisk || 'N/D';

        html += `
          <li>
            <strong>Data:</strong> ${formattedDate}<br>
            <strong>Analista:</strong> ${a.Analista || 'N/D'}<br>
            <strong>Probabilidade:</strong> ${prob}<br>
            <strong>Impacto:</strong> ${imp}<br>
            <strong>Grau Risco:</strong> ${grau}<br>
            <strong>Tratamento:</strong> ${a.Tratamento || 'N/D'}<br>
            <strong>Observações:</strong> ${a.Observacoes || '<em>Nenhuma</em>'}
          </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}
