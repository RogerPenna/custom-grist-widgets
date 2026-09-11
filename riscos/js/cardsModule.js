// js/cardsModule.js
import { 
    RISK_PROB_COLUMN, 
    RISK_IMPACT_COLUMN, 
    RISK_DEPT_COLUMN, 
    RISK_NAME_COLUMN, 
    RISK_IDRISCO_COLUMN, 
    PROX_ANALISE_LIMITS 
} from './config.js';
import { formatDate, diffDays, getDeptName } from './utils.js';

let currentSort = { column: null, asc: true };

// Cores premium para o Grau de Risco
function obterCorGrau(score) {
    if (score === 0) return '#cbd5e1'; // Inexistente
    if (score <= 2) return '#60a5fa';  // Muito Baixo (Azul)
    if (score <= 5) return '#34d399';  // Baixo (Verde)
    if (score <= 10) return '#fbbf24'; // Moderado (Amarelo)
    if (score <= 16) return '#fb923c'; // Elevado (Laranja)
    return '#f87171';                  // Extremo (Vermelho)
}

function getPAValue(r) { return Number(r["$PAs"] || r.PAs || 0) || 0; }
function getTratamento(r) { return r.Ultimo_Tratamento || r.Tratamento || ""; }
function requiresActionPlan(r) { 
    const trat = getTratamento(r).toLowerCase(); 
    return (trat === 'mitigar' || trat === 'eliminar') && getPAValue(r) === 0; 
}

function compareValues(va, vb, asc) {
    if (va === vb) return 0;
    if (va === null || va === undefined || va === "") return asc ? 1 : -1;
    if (vb === null || vb === undefined || vb === "") return asc ? -1 : 1;
    
    if (typeof va === 'string' && typeof vb === 'string') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return asc ? (va - vb) : (vb - va);
}

function getSortValue(r, column) {
    switch (column) {
        case "codigo":
            return r[RISK_IDRISCO_COLUMN] || r.id;
        case "titulo":
            return r[RISK_NAME_COLUMN] || "";
        case "depto":
            return getDeptName(r, RISK_DEPT_COLUMN);
        case "prob":
            return Number(r[RISK_PROB_COLUMN]) || 0;
        case "impact":
            return Number(r[RISK_IMPACT_COLUMN]) || 0;
        case "grau":
            const prob = Number(r[RISK_PROB_COLUMN]) || 0;
            const imp = Number(r[RISK_IMPACT_COLUMN]) || 0;
            return Number(r.UltimoCalcRisk || (prob * imp)) || 0;
        case "trat":
            return getTratamento(r);
        case "acoes":
            return getPAValue(r);
        case "prox":
            return r.DataProxAnalise ? new Date(r.DataProxAnalise).getTime() : 0;
        default:
            return "";
    }
}

function sortArrow(col) { 
    return (currentSort.column === col) ? (currentSort.asc ? ' ▲' : ' ▼') : ''; 
}

// Renderizador principal dos cards em formato de tabela premium
export function renderCards(records, containerId, onCardClickCallback, onBurgerClickCallback, selectedRiskId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!records || records.length === 0) {
      container.innerHTML = '<p class="loading-message">Nenhum risco corresponde aos filtros.</p>';
      return;
    }

    // Ordenação dos dados
    if (currentSort.column) {
      records.sort((a, b) => compareValues(
          getSortValue(a, currentSort.column), 
          getSortValue(b, currentSort.column), 
          currentSort.asc
      ));
    }

    // Cabeçalho da tabela
    let headerHtml = `
        <div class="table-header">
            <div class="burger-btn" style="width: 24px; visibility: hidden;"> </div>
            <div class="col-codigo" data-sort="codigo">Código${sortArrow("codigo")}</div>
            <div class="col-titulo" data-sort="titulo">Título${sortArrow("titulo")}</div>
            <div class="col-depto" data-sort="depto">Departamento${sortArrow("depto")}</div>
            <div class="col-prob" data-sort="prob">Prob${sortArrow("prob")}</div>
            <div class="col-imp" data-sort="impact">Impacto${sortArrow("impact")}</div>
            <div class="col-grau" data-sort="grau">Grau${sortArrow("grau")}</div>
            <div class="col-tratamento" data-sort="trat">Tratamento${sortArrow("trat")}</div>
            <div class="col-acoes" data-sort="acoes">PAs${sortArrow("acoes")}</div>
            <div class="col-prox" data-sort="prox">Próx. Análise${sortArrow("prox")}</div>
        </div>`;

    // Linhas
    let rowsHtml = records.map(risk => buildRow(risk, risk.id === selectedRiskId)).join('');

    container.innerHTML = headerHtml + rowsHtml;

    // Listeners de ordenação ao clicar no cabeçalho
    container.querySelector(".table-header")?.addEventListener("click", (e) => {
        let target = e.target.closest("[data-sort]");
        if (!target) return;
        let col = target.getAttribute("data-sort");
        if (!col) return;
        
        if (currentSort.column === col) { 
            currentSort.asc = !currentSort.asc; 
        } else { 
            currentSort.column = col; 
            currentSort.asc = true; 
        }
        
        if (window.renderAll) {
            window.renderAll();
        }
    });

    // Listeners de clique nas linhas e no botão hambúrguer
    container.querySelectorAll('.table-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.burger-btn')) return;
            const riskId = parseInt(row.dataset.riskId || "0", 10);
            if (onCardClickCallback && riskId > 0) {
                onCardClickCallback(riskId);
            }
        });

        const burger = row.querySelector('.burger-btn');
        if (burger) {
            burger.addEventListener('click', (e) => {
                e.stopPropagation(); // Evita ativar a seleção da linha ao ver detalhes
                const riskId = parseInt(row.dataset.riskId || "0", 10);
                if (onBurgerClickCallback && riskId > 0) {
                    onBurgerClickCallback(riskId);
                }
            });
        }
    });
}

// Constrói o HTML para cada linha de risco
function buildRow(risk, isSelected) {
    const riskId = risk.id;
    const probValue = Number(risk[RISK_PROB_COLUMN]) || 0;
    const impValue = Number(risk[RISK_IMPACT_COLUMN]) || 0;

    const selectedClass = isSelected ? " selected" : "";

    const codStr = risk[RISK_IDRISCO_COLUMN] || String(riskId);
    // Pad com zeros apenas se for puramente numérico
    const codDisplay = !isNaN(codStr) ? `RSK-${String(codStr).padStart(4, '0')}` : codStr;
    
    const codigo = `<div class="col-codigo">${codDisplay}</div>`;
    const fullTitle = risk[RISK_NAME_COLUMN] || "Sem nome";
    const titulo = `<div class="col-titulo" title="${fullTitle}">${fullTitle}</div>`;
    const dept = getDeptName(risk, RISK_DEPT_COLUMN);
    const deptDiv = `<div class="col-depto" title="${dept}">${dept}</div>`;

    // --- Probabilidade ---
    const probText = risk.UltimaProbabilidade || `${probValue}`;
    const probDiv = `<div class="col-prob" title="${probText}"><span>${probValue}</span></div>`;

    // --- Impacto ---
    const impText = risk.Ultimo_Impacto || `${impValue}`;
    const impDiv = `<div class="col-imp" title="${impText}"><span>${impValue}</span></div>`;

    // --- Grau de Risco ---
    const grauCalc = Number(risk.UltimoCalcRisk || (probValue * impValue)) || 0;
    const grauTextDisplay = risk["$Grau_de_Risco_Atual"]?.[1] || risk.Grau_de_Risco_Atual || (grauCalc > 0 ? `Score: ${grauCalc}` : "-");
    const bgGrau = obterCorGrau(grauCalc);
    const grauDiv = `<div class="col-grau"><span style="background-color: ${bgGrau};">${grauTextDisplay}</span></div>`;

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
      acoesHTML = `<span class="acoes alert" title="Requer Plano de Ação! (Tratamento Mitigar/Eliminar sem PAs)">${paCount}</span>`;
    }
    const acoesDiv = `<div class="col-acoes">${acoesHTML}</div>`;

    // --- Próxima Análise ---
    const dataProx = risk.DataProxAnalise || "";
    const fDate = formatDate(dataProx);
    const dnum = diffDays(dataProx);
    let proxClass = "cinza";
    let proxTitle = `Próxima análise: ${fDate || 'N/D'}`;
    
    if (fDate) {
        if (dnum >= PROX_ANALISE_LIMITS.VERDE) proxClass = "verde";
        else if (dnum >= PROX_ANALISE_LIMITS.AMARELO) proxClass = "amarelo";
        else if (dnum >= PROX_ANALISE_LIMITS.LARANJA) proxClass = "laranja";
        else proxClass = "vermelho";
        
        const daysDiff = Math.abs(Math.round(dnum));
        proxTitle += ` (${dnum >= 0 ? 'em' : 'atrasado'} ${daysDiff} dias)`;
    }
    const proxDiv = `<div class="col-prox"><span class="proxima-analise ${proxClass}" title="${proxTitle}">${fDate || "-"}</span></div>`;

    // Botão Hambúrguer de Detalhes
    const burgerIcon = `<span class="burger-btn" title="Ver detalhes do risco">☰</span>`;

    return `
        <div class="table-row${selectedClass}" data-risk-id="${riskId}" data-prob="${probValue}" data-imp="${impValue}">
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
