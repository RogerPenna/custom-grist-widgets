// js/matrixModule.js
import { MATRIX_MAX_VALUE, RISK_PROB_COLUMN, RISK_IMPACT_COLUMN, RISK_DEPT_COLUMN, RISK_NAME_COLUMN, RISK_IDRISCO_COLUMN } from './config.js';
import { getDeptName } from './utils.js'; // Importa se necessário

let cellHeight = 40; // Estado interno do módulo

// Funções internas do módulo (não exportadas)
function applyCellSize() {
    document.documentElement.style.setProperty('--cell-height', `${cellHeight}px`);
}

function obterCorRisco(score) {
    if (score === 0) return ['#d3d3d3', 'Inexistente', '#a9a9a9'];
    if (score <= 2) return ['#157AFB', 'Muito Baixo', '#0e5cad'];
    if (score <= 5) return ['#2AE028', 'Baixo', '#1f9d1f'];
    if (score <= 10) return ['#E8D62F', 'Moderado', '#b39b1e'];
    if (score <= 16) return ['#FD9D28', 'Elevado', '#c7761c'];
    return ['#E00A17', 'Extremo', '#a10b12'];
}

function applyFade(color) {
    let opacity = 0.3;
    if (!color || !color.startsWith('#')) return `rgba(200, 200, 200, ${opacity})`;
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Adapte estas funções para pegar os nomes das colunas do config.js
function getPAValue(r) { return Number(r["$PAs"] || r.PAs || r["$PA"] || r.PA || 0) || 0; }
function getTratamento(r) { return r["$Ultimo_Tratamento"] || r.Ultimo_Tratamento || r.Tratamento || ""; }
function getOverdueValue(r) { return Number(r["$Atrasado_"] || r.Atrasado_ || 0) || 0; }
function requiresActionPlan(risk) {
    const trat = getTratamento(risk).toLowerCase();
    const pa = getPAValue(risk);
    return ((trat === "mitigar" || trat === "eliminar") && pa === 0);
}

function gerarTooltip(risks) {
    // (Adapte esta função para usar nomes de colunas do config.js)
     if (!risks || risks.length === 0) return "Nenhum risco nesta célula";
    let lines = [`${risks.length} Risco(s):`];
    let byDept = {};
    risks.forEach(r => {
        let dept = getDeptName(r, RISK_DEPT_COLUMN).toUpperCase(); // Usa função utils
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(r);
    });
    let depts = Object.keys(byDept).sort();
    depts.forEach(dept => {
        if (lines.length > 1) lines.push("---");
        lines.push("🔶 " + dept);
        byDept[dept].sort((a, b) => (a[RISK_NAME_COLUMN] || "").localeCompare(b[RISK_NAME_COLUMN] || ""))
            .forEach(rr => {
                let rid = rr[RISK_IDRISCO_COLUMN] || ("" + rr.id).padStart(4, '0');
                let line = `   ${rid}`;
                if (requiresActionPlan(rr)) line += " 🔴";
                if (getOverdueValue(rr) > 0) line += " 🟠";
                line += " : " + (rr[RISK_NAME_COLUMN] || "Sem nome");
                lines.push(line);
            });
    });
    const maxLines = 30;
    if (lines.length > maxLines) { /* ... (limita tooltip) ... */ }
    return lines.join("\n").replace(/"/g, '"');
}


// --- Funções Exportadas ---

/** Renderiza a Matriz de Risco */
export function renderMatrix(records, containerId, highlight, filter, onCellClickCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    applyCellSize();

    if (!records || records.length === 0) {
      container.innerHTML = '<p class="loading-message">Nenhum risco para exibir na matriz.</p>';
      return;
    }

    let riskMap = {};
    records.forEach(record => {
        let impacto = record[RISK_IMPACT_COLUMN] || 0;
        let prob = record[RISK_PROB_COLUMN] || 0;
        let key = `${prob}-${impacto}`;
        if (!riskMap[key]) riskMap[key] = [];
        riskMap[key].push(record);
    });

    const max_valor = MATRIX_MAX_VALUE;

    function isCellSelected(prob, imp) { /* ... (lógica como antes) ... */ }

    let totalCount = records.length;
    let undocumented = records.filter(r => (r[RISK_IMPACT_COLUMN] || 0) == 0 || (r[RISK_PROB_COLUMN] || 0) == 0).length;
    let hasNoFilterOrHighlight = (!filter && !highlight) ? " selected" : "";

    let html = `<table class="matrix-table">
        <tr>
            <th rowspan="2" colspan="2" class="matrix-header${hasNoFilterOrHighlight}"
                style="width: 20%;" data-prob="null" data-imp="null"> <!-- Add data attributes -->
                <div><span style="font-size: 20px;">${totalCount}</span> <span style="font-size: 12px;">Riscos</span></div>
                <div style="margin-top: 3px;"><span style="font-size: 12px;">(${undocumented} não class.)</span></div>
            </th>
            <th colspan="${max_valor}" class="matrix-header">IMPACTO</th>
        </tr>
        <tr>`;
    for (let i = 1; i <= max_valor; i++) {
        let selectedClass = (filter && filter.probability === null && filter.impact == i) ? " selected" : "";
        html += `<th class="matrix-header${selectedClass}" data-prob="null" data-imp="${i}">${i}</th>`;
    }
    html += `</tr>`;

    for (let p = max_valor; p >= 1; p--) {
        html += `<tr>`;
        if (p === max_valor) {
             html += `<th rowspan="${max_valor}" class="matrix-header probabilidade-header" data-prob="null" data-imp="null">PROBABILIDADE</th>`; // Header geral não filtra
        }
        let selProb = (filter && filter.probability == p && filter.impact === null) ? " selected" : "";
        html += `<th class="matrix-header${selProb}" data-prob="${p}" data-imp="null">${p}</th>`;

        for (let imp = 1; imp <= max_valor; imp++) {
            let key = `${p}-${imp}`;
            let riskScore = p * imp;
            let [bgColor, , borderColor] = obterCorRisco(riskScore);
            let risks = riskMap[key] || [];
            let count = risks.length;
            let noPlans = risks.filter(requiresActionPlan).length;
            let overdue = risks.filter(r => getOverdueValue(r) > 0).length;
            let cellColor = (count === 0) ? applyFade(bgColor) : bgColor;
            // let cellSelected = isCellSelected(p, imp) ? " selected" : ""; // Lógica isCellSelected pode ser simplificada
             let cellSelectedClass = "";
             if (filter && filter.probability == p && filter.impact == imp) cellSelectedClass = " selected";
             else if (filter && filter.probability == p && filter.impact === null) cellSelectedClass = " selected"; // Linha selecionada
             else if (filter && filter.probability === null && filter.impact == imp) cellSelectedClass = " selected"; // Coluna selecionada
             else if (!filter && highlight && highlight.probability == p && highlight.impact == imp) cellSelectedClass = " selected"; // Highlight
             else if (!filter && !highlight && hasNoFilterOrHighlight) cellSelectedClass = " selected"; // Header geral

            let tooltip = gerarTooltip(risks);

            html += `<td class="risk-cell${cellSelectedClass}"
                data-prob="${p}" data-imp="${imp}"
                style="background-color:${cellColor}; --border-color:${borderColor};"
                title="${tooltip}">
                    <div class="counter">${count}</div>
                    ${noPlans > 0 ? `<div class="alert-badge" title="${noPlans} risco(s) requer(em) plano de ação">${noPlans}</div>` : ""}
                    ${overdue > 0 ? `<div class="overdue-badge" title="${overdue} risco(s) com análise atrasada">${overdue}</div>` : ""}
                </td>`;
        }
        html += `</tr>`;
    }
    html += `</table>
        <div class="size-controls">
             <button class="legend-button" title="...">Legenda</button> <!-- Tooltip da legenda -->
             <div>
                 <button class="size-btn" id="btn-matrix-decrease" title="Diminuir células">−</button>
                 <button class="size-btn" id="btn-matrix-increase" title="Aumentar células">+</button>
             </div>
         </div>`;

    container.innerHTML = html;

    // Adiciona listeners dinamicamente em vez de onclick="..."
    container.querySelectorAll('.matrix-header, .risk-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
             const targetCell = e.currentTarget;
             // dataset.prob e dataset.imp podem ser strings 'null'
             let prob = targetCell.dataset.prob === 'null' ? null : parseInt(targetCell.dataset.prob, 10);
             let imp = targetCell.dataset.imp === 'null' ? null : parseInt(targetCell.dataset.imp, 10);
             if (onCellClickCallback) {
                 onCellClickCallback(prob, imp);
             }
        });
    });
    document.getElementById('btn-matrix-decrease')?.addEventListener('click', () => adjustSize(-10));
    document.getElementById('btn-matrix-increase')?.addEventListener('click', () => adjustSize(10));
}

/** Ajusta o tamanho da célula da matriz */
export function adjustSize(change) {
    cellHeight = Math.max(20, Math.min(100, cellHeight + change));
    applyCellSize();
}
