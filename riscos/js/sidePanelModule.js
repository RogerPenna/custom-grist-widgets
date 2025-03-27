// js/sidePanelModule.js
import { fetchAllAnalyses, filterAnalysesForRisk } from './gristApiService.js';
import { formatDate, getDeptName } from './utils.js';
import { RISK_DEPT_COLUMN, RISK_NAME_COLUMN, RISK_IDRISCO_COLUMN, ANALYSIS_DATE_COLUMN } from './config.js'; // Importa nomes de colunas

const panelElement = document.getElementById('side-panel');
const titleElement = document.getElementById('side-panel-title');
const tabsNavElement = panelElement?.querySelector('.tabs-nav');
const tabContentsElement = panelElement?.querySelectorAll('.tab-content');
const tabButtonsElement = panelElement?.querySelectorAll('.tab-button');
const closeButton = document.getElementById('btn-close-side-panel');

let currentRiskData = null; // Guarda os dados do risco selecionado
let currentActiveTab = 'detalhes'; // Estado da aba ativa

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
        titleElement.textContent = `Detalhes: ${riskRecord[RISK_IDRISCO_COLUMN] || riskRecord.id} - ${riskRecord[RISK_NAME_COLUMN] || 'Sem Nome'}`;
    }

    // Renderiza detalhes imediatamente
    renderRiskDetails();
    // Limpa/reseta outras abas
    const analysesTab = document.getElementById('tab-analises');
    if (analysesTab) analysesTab.innerHTML = '<p class="loading-message">Clique para carregar análises.</p>';
    // Resetar outras abas se necessário...

    panelElement.style.display = 'flex';
    activateTab('detalhes'); // Garante que detalhes é a aba ativa inicial
}

/** Fecha o painel lateral. */
export function closeSidePanel() {
    if (!panelElement) return;
    panelElement.style.display = 'none';
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
        await loadAndRenderAnalyses(); // Carrega dados se a aba de análises for ativada
    }
    // Adicionar lógica para outras abas se necessário
}

/** Renderiza os detalhes do risco atual na aba 'detalhes'. */
function renderRiskDetails() {
    const container = document.getElementById('tab-detalhes');
    if (!container) return;
    if (!currentRiskData) {
        container.innerHTML = '<p>Erro: Dados do risco não disponíveis.</p>';
        return;
    }
    // Adapte os campos conforme sua tabela Riscos e nomes em config.js
    container.innerHTML = `
        <h3>${currentRiskData[RISK_NAME_COLUMN] || "Sem nome"} (#${currentRiskData[RISK_IDRISCO_COLUMN] || currentRiskData.id})</h3>
        <p><strong>Departamento:</strong> ${getDeptName(currentRiskData, RISK_DEPT_COLUMN)}</p>
        <p><strong>Descrição:</strong> ${currentRiskData.Descricao || "<em>Não fornecida</em>"}</p>
        <hr>
        <p><strong>Última Probabilidade:</strong> ${currentRiskData.UltimaProbabilidade || currentRiskData[RISK_PROB_COLUMN] || "N/A"}</p>
        <p><strong>Último Impacto:</strong> ${currentRiskData.Ultimo_Impacto || currentRiskData[RISK_IMPACT_COLUMN] || "N/A"}</p>
        <!-- Adapte como o grau é exibido -->
        <p><strong>Grau de Risco Atual:</strong> ${currentRiskData.Grau_de_Risco_Atual?.[1] || currentRiskData.UltimoCalcRisk || 'N/A'}</p>
        <p><strong>Tratamento Atual:</strong> ${currentRiskData.Ultimo_Tratamento || "N/A"}</p>
        <p><strong>Planos de Ação Vinculados:</strong> ${currentRiskData.PAs || '0'}</p>
        <p><strong>Próxima Análise:</strong> ${formatDate(currentRiskData.DataProxAnalise) || "<em>Não definida</em>"}</p>
    `;
}

/** Carrega (se necessário) e renderiza as análises para o risco atual. */
async function loadAndRenderAnalyses() {
    const container = document.getElementById('tab-analises');
    if (!container || !currentRiskData) return;

    container.innerHTML = '<p class="loading-message"><em>Carregando análises...</em></p>';
    try {
        // Garante que a coluna de ligação foi identificada e os dados buscados
        await findAnalysisLinkingColumn(); // Tenta identificar (usa cache se já tiver)
        await fetchAllAnalyses();          // Tenta buscar/usar cache

        // Filtra os dados cacheados
        const relatedAnalyses = filterAnalysesForRisk(currentRiskData.id);

        renderRiskAnalyses(relatedAnalyses);

    } catch (error) {
        console.error("Erro ao carregar/renderizar análises:", error);
        container.innerHTML = `<p style="color: red;">Erro ao carregar análises: ${error.message}</p>`;
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

    // Ordena análises (opcional, por data decrescente)
    analyses.sort((a, b) => {
        let dateA = a[ANALYSIS_DATE_COLUMN] ? (typeof a[ANALYSIS_DATE_COLUMN] === 'number' ? a[ANALYSIS_DATE_COLUMN] : new Date(a[ANALYSIS_DATE_COLUMN]).getTime()) : 0;
        let dateB = b[ANALYSIS_DATE_COLUMN] ? (typeof b[ANALYSIS_DATE_COLUMN] === 'number' ? b[ANALYSIS_DATE_COLUMN] : new Date(b[ANALYSIS_DATE_COLUMN]).getTime()) : 0;
        return (dateB || 0) - (dateA || 0); // Trata N/A como 0
    });

    // Monta o HTML - Adapte os nomes das colunas conforme sua tabela Analise_Risco
    let html = '<ul>';
    analyses.forEach(a => {
        html += `
          <li>
            <strong>ID Análise:</strong> ${a.id}<br>
            <strong>Data:</strong> ${formatDate(a[ANALYSIS_DATE_COLUMN]) || 'N/D'}<br>
            <strong>Analista:</strong> ${a.Analista || 'N/D'}<br>
            <strong>Probabilidade:</strong> ${a.Probabilidade || 'N/D'}<br>
            <strong>Impacto:</strong> ${a.Consequencia || 'N/D'}<br> <!-- Exemplo: usando Consequencia -->
            <strong>Grau Risco:</strong> ${a.Grau_de_Risco?.[1] || a.CalcRisk || 'N/D'}<br> <!-- Exemplo: usando ChoiceList -->
            <strong>Tratamento:</strong> ${a.Tratamento || 'N/D'}<br>
            <strong>Observações:</strong> ${a.Observacoes || '<em>Nenhuma</em>'}
          </li>
        `;
    });
    html += '</ul>';

    container.innerHTML = html;
}
