// js/cardsModule.js
import { RISK_PROB_COLUMN, RISK_IMPACT_COLUMN, RISK_DEPT_COLUMN, RISK_NAME_COLUMN, RISK_IDRISCO_COLUMN, PROX_ANALISE_LIMITS } from './config.js';
import { formatDate, diffDays, getDeptName } from './utils.js';
// Importar cores da matriz se necessário ou definir localmente
// import { obterCorRisco } from './matrixModule.js'; // Exemplo

let currentSort = { column: null, asc: true };

// Definições de cores (pode centralizar em config.js se preferir)
const probColors = { /* ... cores ... */ };
const impactColors = { /* ... cores ... */ };
const grauColors = { /* ... cores ... */ }; // Mapeamento de score para {bg, font}

// Funções auxiliares específicas dos cards
function getPAValue(r) { /* ... (duplicado ou importar?) ... */ return Number(r["$PAs"] || r.PAs || 0) || 0; }
function getTratamento(r) { /* ... */ return r.Ultimo_Tratamento || r.Tratamento || ""; }
function requiresActionPlan(r) { /* ... */ const trat = getTratamento(r).toLowerCase(); return (trat === 'mitigar' || trat === 'eliminar') && getPAValue(r) === 0; }

function compareValues(va, vb, asc) { /* ... (lógica de comparação) ... */ }
function getSortValue(r, column) { /* ... (lógica para obter valor de ordenação) ... */ }
function sortArrow(col) { return (currentSort.column === col) ? (currentSort.asc ? '▲' : '▼') : ''; }

// Função principal exportada
export function renderCards(records, containerId, onCardClickCallback, onBurgerClickCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!records || records.length === 0) {
      container.innerHTML = '<p class="loading-message">Nenhum risco corresponde aos filtros.</p>';
      return;
    }

    // Ordena
    if (currentSort.column) {
      records.sort((a, b) => compareValues(getSortValue(a, currentSort.column), getSortValue(b, currentSort.column), currentSort.asc));
    }

    // Cabeçalho
    let headerHtml = `
        <div class="table-header">
            <div class="burger-btn" style="width: 25px; visibility: hidden;"> </div>
            <div class="col-codigo" data-sort="codigo">Código ${sortArrow("codigo")}</div>
            <div class="col-titulo" data-sort="titulo">Título ${sortArrow("titulo")}</div>
            <div class="col-depto" data-sort="depto">Departamento ${sortArrow("depto")}</div>
            <div class="col-prob" data-sort="prob">Prob ${sortArrow("prob")}</div>
            <div class="col-imp" data-sort="impact">Impacto ${sortArrow("impact")}</div>
            <div class="col-grau" data-sort="grau">Grau ${sortArrow("grau")}</div>
            <div class="col-tratamento" data-sort="trat">Tratamento ${sortArrow("trat")}</div>
            <div class="col-acoes" data-sort="acoes">PAs ${sortArrow("acoes")}</div>
            <div class="col-prox" data-sort="prox">Próx. Análise ${sortArrow("prox")}</div>
        </div>`;

    // Linhas (Cards)
    let rowsHtml = records.map(risk => buildRow(risk)).join(''); // Gera HTML para cada linha

    container.innerHTML = headerHtml + rowsHtml;

    // Adiciona listeners dinamicamente
    container.querySelector(".table-header")?.addEventListener("click", (e) => {
        let target = e.target.closest("[data-sort]");
        if (!target) return;
        let col = target.getAttribute("data-sort");
        if (!col) return;
        if (currentSort.column === col) { currentSort.asc = !currentSort.asc; }
        else { currentSort.column = col; currentSort.asc = true; }
        // Re-renderiza chamando a função principal (passada como callback ou via evento customizado)
        // Por simplicidade aqui, vamos assumir que main.js tem uma função renderAll() global ou acessível
        if (window.renderAll) window.renderAll(); // Exemplo simples, pode ser melhorado
    });

    container.querySelectorAll('.table-row').forEach(row => {
        // Clique na linha para highlight na matriz
        row.addEventListener('click', (e) => {
            // Evita trigger se clicar no burger
            if (e.target.closest('.burger-btn')) return;
            const prob = parseInt(row.dataset.prob || "0", 10);
            const imp = parseInt(row.dataset.imp || "0", 10);
            if (onCardClickCallback) onCardClickCallback(prob, imp);
        });
        // Clique no burger para abrir painel
        const burger = row.querySelector('.burger-btn');
        if (burger) {
            burger.addEventListener('click', (e) => {
                e.stopPropagation(); // Impede que o clique da linha seja disparado
                const riskId = parseInt(row.dataset.riskId || "0", 10);
                 if (onBurgerClickCallback && riskId > 0) onBurgerClickCallback(riskId);
            });
        }
    });
}


// Constrói o HTML para uma linha/card
function buildRow(risk) {
    const riskId = risk.id;
    const probValue = risk[RISK_PROB_COLUMN] || 0;
    const impValue = risk[RISK_IMPACT_COLUMN] || 0;

    const codigo = `<div class="col-codigo">${risk[RISK_IDRISCO_COLUMN] || riskId}</div>`;
    const fullTitle = risk[RISK_NAME_COLUMN] || "Sem nome";
    const titulo = `<div class="col-titulo" title="${fullTitle}">${fullTitle}</div>`;
    const dept = getDeptName(risk, RISK_DEPT_COLUMN);
    const deptDiv = `<div class="col-depto" title="${dept}">${dept}</div>`;

    // --- Probabilidade ---
    const probText = risk.UltimaProbabilidade || `${probValue}`; // Assumindo coluna de texto existe
    // const [probColor] = obterCorRisco(probValue * 1); // Se importar de matrixModule
    const probDiv = `<div class="col-prob" title="${probText}"><span>${probValue}</span></div>`; // Simplificado

    // --- Impacto ---
    const impText = risk.Ultimo_Impacto || `${impValue}`;
    // const [impColor] = obterCorRisco(impValue * 3);
    const impDiv = `<div class="col-imp" title="${impText}"><span>${impValue}</span></div>`; // Simplificado

    // --- Grau ---
    const grauCalc = Number(risk.UltimoCalcRisk || (probValue * impValue)) || 0;
    // const [grauColor, grauText] = obterCorRisco(grauCalc); // Se importar
    const grauTextDisplay = risk["$Grau_de_Risco_Atual"]?.[1] || grauCalc; // Pega texto da ChoiceList ou usa cálculo
    const grauDiv = `<div class="col-grau"><span style="padding:2px 4px; border-radius:4px;">${grauTextDisplay}</span></div>`; // Simplificado

    // --- Tratamento ---
    const tratValue = getTratamento(risk);
    let tratClass = "";
    if (tratValue.toLowerCase() === "aceitar") tratClass = "tratamento-aceitar";
    if (tratValue.toLowerCase() === "mitigar") tratClass = "tratamento-mitigar";
    if (tratValue.toLowerCase() === "eliminar") tratClass = "tratamento-eliminar";
    const tratDiv = `<div class="col-tratamento"><span class="${tratClass}">${tratValue || "-"}</span></div>`;

    // --- Ações ---
    const paCount = getPAValue(risk);
    let acoesHTML = `<span class="acoes">${paCount}</span>`;
    if (requiresActionPlan(risk)) {
      acoesHTML = `<span class="acoes alert" title="Requer Plano de Ação!">${paCount}</span>`;
    }
    const acoesDiv = `<div class="col-acoes">${acoesHTML}</div>`;

    // --- Próxima Análise ---
    const dataProx = risk.DataProxAnalise || "";
    const fDate = formatDate(dataProx);
    const dnum = diffDays(dataProx);
    let proxClass = "cinza"; // Default
    let proxTitle = `Próxima análise: ${fDate || 'N/D'}`;
    if (fDate) {
        if (dnum >= PROX_ANALISE_LIMITS.VERDE) proxClass = "verde";
        else if (dnum >= PROX_ANALISE_LIMITS.AMARELO) proxClass = "amarelo";
        else if (dnum >= PROX_ANALISE_LIMITS.LARANJA) proxClass = "laranja";
        else proxClass = "vermelho";
        proxTitle += ` (${dnum >= 0 ? 'em' : 'atrasado'} ${Math.abs(Math.round(dnum))} dias)`;
    }
    const proxDiv = `<div class="col-prox"><span class="proxima-analise ${proxClass}" title="${proxTitle}">${fDate || "-"}</span></div>`;

    // --- Burger Icon ---
    const burgerIcon = `<span class="burger-btn" title="Ver detalhes">☰</span>`;

    // Adiciona data attributes para callbacks
    return `
        <div class="table-row" data-risk-id="${riskId}" data-prob="${probValue}" data-imp="${impValue}">
            ${burgerIcon}
            ${codigo}
            ${titulo}
            ${deptDiv}
            ${probDiv}
            ${impDiv}
            ${grauDiv}
            ${tratDiv}
            ${acoesDiv}
            ${proxDiv}
        </div>`;
}
