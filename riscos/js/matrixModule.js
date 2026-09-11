// js/matrixModule.js
import { 
    MATRIX_MAX_VALUE, 
    getColumnKey
} from './config.js';
import { getDeptName, formatDate } from './utils.js';

let cellHeight = 48; // Estado interno do módulo

// --- Getters Dinâmicos de Colunas ---
const getColIdRisco = () => getColumnKey('IDRisco', 'idRiscoField');
const getColNomeRisco = () => getColumnKey('NomeRisco', 'nomeRiscoField');
const getColDepto = () => getColumnKey('Departamento', 'deptoField');
const getColProb = () => getColumnKey('ultprob', 'probField');
const getColImpact = () => getColumnKey('ultimpac', 'impactField');
const getColInherentProb = () => getColumnKey('Probabilidade_Inerente_Num', 'inherentProbField');
const getColInherentImpact = () => getColumnKey('Impacto_Inerente_Num', 'inherentImpactField');
const getColPAs = () => getColumnKey('PAs', 'pasField');
const getColTratamento = () => getColumnKey('Ultimo_Tratamento', 'tratamentoField');

// For analyses columns:
const getColAnalysisProb = () => getColumnKey('ProbNum', 'analysisProbField');
const getColAnalysisImpact = () => getColumnKey('ImpactNum', 'analysisImpactField');
const getColAnalysisDate = () => getColumnKey('Data_Analise', 'analysisDateField');

function applyCellSize() {
    document.documentElement.style.setProperty('--cell-height', `${cellHeight}px`);
}

// Cores originais do usuário exatas
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

function getPAValue(r) { return Number(r["$PAs"] || r[getColPAs()] || r.PAs || r["$PA"] || r.PA || 0) || 0; }
function getTratamento(r) { return r["$Ultimo_Tratamento"] || r[getColTratamento()] || r.Ultimo_Tratamento || r.Tratamento || ""; }
function getOverdueValue(r) { return Number(r["$Atrasado_"] || r.Atrasado_ || 0) || 0; }
function requiresActionPlan(risk) {
    const trat = getTratamento(risk).toLowerCase();
    const pa = getPAValue(risk);
    return ((trat === "mitigar" || trat === "eliminar") && pa === 0);
}

function gerarTooltip(risks) {
    if (!risks || risks.length === 0) return "Nenhum risco nesta célula";
    let tooltipLines = [];
    let byDept = {};
    risks.forEach(r => {
        let dept = getDeptName(r, getColDepto()).toUpperCase();
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(r);
    });
    let depts = Object.keys(byDept).sort();
    depts.forEach(dept => {
        if (tooltipLines.length > 0) tooltipLines.push("");
        tooltipLines.push(`🔶 ${dept}`);
        byDept[dept].sort((a, b) => (a[getColNomeRisco()] || "").localeCompare(b[getColNomeRisco()] || ""))
            .forEach(rr => {
                let rid = rr[getColIdRisco()] || rr.id;
                let formattedId = ("0000" + rid).slice(-4);
                let line = `  RSK-${formattedId}`;
                if (requiresActionPlan(rr)) line += " 🔴";
                if (getOverdueValue(rr) > 0) line += " 🟡";
                line += " : " + (rr[getColNomeRisco()] || "Sem nome");
                tooltipLines.push(line);
            });
    });
    return tooltipLines.join("&#013;").replace(/"/g, '&quot;');
}

// --- Funções Exportadas ---

/** Renderiza a Matriz de Risco (Geral ou Evolução Individual no Drawer) */
export function renderMatrix(records, containerId, highlight, filter, onCellClickCallback, selectedRisk = null, selectedRiskAnalyses = []) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;
    
    const isDrawerMatrix = containerId === 'drawer-matrix-container';
    
    if (!isDrawerMatrix) {
        applyCellSize();
    }

    if (!isDrawerMatrix && (!records || records.length === 0)) {
      container.innerHTML = '<p class="loading-message">Nenhum risco para exibir na matriz.</p>';
      return;
    }

    // --- MODO DE EVOLUÇÃO ---
    let evolutionSteps = [];
    let isEvolutionMode = false;
    let stepsByCell = {};

    if (selectedRisk) {
        isEvolutionMode = true;
        
        // 1. Passo Inerente (se disponível)
        const inherentP = Number(selectedRisk[getColInherentProb()]) || 0;
        const inherentI = Number(selectedRisk[getColInherentImpact()]) || 0;
        if (inherentP > 0 && inherentI > 0) {
            evolutionSteps.push({
                prob: inherentP,
                imp: inherentI,
                label: "I",
                type: "inerente",
                title: `Inerente (P:${inherentP}, I:${inherentI})`
            });
        }

        // 2. Passos de Análises Históricas
        if (selectedRiskAnalyses && selectedRiskAnalyses.length > 0) {
            const sortedAnalyses = [...selectedRiskAnalyses].sort((a, b) => {
                const dateValA = a[getColAnalysisDate()] || a.DataAnalise || 0;
                const dateValB = b[getColAnalysisDate()] || b.DataAnalise || 0;
                const timeA = typeof dateValA === 'number' ? dateValA * 1000 : new Date(dateValA).getTime();
                const timeB = typeof dateValB === 'number' ? dateValB * 1000 : new Date(dateValB).getTime();
                return timeA - timeB;
            });

            sortedAnalyses.forEach((a, idx) => {
                const p = Number(a[getColAnalysisProb()] || a.ProbNum || a.Probabilidade || 0);
                const i = Number(a[getColAnalysisImpact()] || a.ImpactNum || a.Consequencia || 0);
                const dateVal = a[getColAnalysisDate()] || a.DataAnalise;
                const formattedDate = formatDate(dateVal) || "Sem Data";
                if (p > 0 && i > 0) {
                    evolutionSteps.push({
                        prob: p,
                        imp: i,
                        label: String(idx + 1),
                        type: "analise",
                        title: `Análise em ${formattedDate} (P:${p}, I:${i})`
                    });
                }
            });
        }

        evolutionSteps.forEach((step, idx) => {
            const key = `${step.prob}-${step.imp}`;
            if (!stepsByCell[key]) stepsByCell[key] = [];
            stepsByCell[key].push({ ...step, index: idx });
        });
    }

    // Mapeia registros gerais (para contagem)
    let riskMap = {};
    if (records) {
        records.forEach(record => {
            let impacto = record[getColImpact()] || 0;
            let prob = record[getColProb()] || 0;
            let key = `${prob}-${impacto}`;
            if (!riskMap[key]) riskMap[key] = [];
            riskMap[key].push(record);
        });
    }

    const max_valor = MATRIX_MAX_VALUE;
    let totalCount = records ? records.length : 0;
    let undocumented = records ? records.filter(r => (r[getColImpact()] || 0) == 0 || (r[getColProb()] || 0) == 0).length : 0;
    let hasNoFilterOrHighlight = (!filter && !highlight && !isEvolutionMode) ? " selected" : "";

    let fadedTableClass = isEvolutionMode ? " faded" : "";

    // Adapta altura e classes se for renderizada no drawer
    const drawerStyleAttr = isDrawerMatrix ? ' style="--cell-height: 38px;"' : '';

    let html = `
    <div class="matrix-wrapper">
        <table class="matrix-table${fadedTableClass}"${drawerStyleAttr}>
            <tr>
                <th rowspan="2" colspan="2" class="matrix-header"
                    style="width: 20%; cursor: pointer;" data-prob="null" data-imp="null">
                    ${isDrawerMatrix ? 
                      `<div><span style="font-size: 11px;">Evolução</span></div>` : 
                      `⚠️ ${totalCount}<br>📄 ${undocumented}`
                    }
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
             html += `<th rowspan="${max_valor}" class="matrix-header probabilidade-header" data-prob="null" data-imp="null">PROBABILIDADE</th>`;
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
            
            let cellColor = (count === 0 && !isEvolutionMode) ? applyFade(bgColor) : bgColor;
            
            let cellSelectedClass = "";
            
            if (isEvolutionMode) {
                if (stepsByCell[key]) {
                    cellSelectedClass = " selected";
                }
            } else {
                if (filter && filter.probability == p && filter.impact == imp) cellSelectedClass = " selected";
                else if (filter && filter.probability == p && filter.impact === null) cellSelectedClass = " selected";
                else if (filter && filter.probability === null && filter.impact == imp) cellSelectedClass = " selected";
                else if (!filter && highlight && highlight.probability == p && highlight.impact == imp) cellSelectedClass = " selected";
                else if (!filter && !highlight && hasNoFilterOrHighlight) cellSelectedClass = " selected";
            }

            let cellContent = "";
            let tooltip = "";

            if (isEvolutionMode) {
                const steps = stepsByCell[key] || [];
                if (steps.length > 0) {
                    tooltip = steps.map(s => s.title).join("\n");
                    cellContent = `
                    <div class="cell-evolution-container" style="display:flex; flex-direction:row; flex-wrap:wrap; justify-content:center; align-items:center; gap:3px; width:100%; height:100%;">
                        ${steps.map(step => `
                            <div class="evolution-step-marker ${step.type === 'inerente' ? 'step-inerente' : ''}" 
                                 data-step-index="${step.index}"
                                 title="${step.title}">
                                ${step.label}
                            </div>
                        `).join('')}
                    </div>`;
                } else {
                    cellColor = applyFade(bgColor);
                }
            } else {
                tooltip = gerarTooltip(risks);
                cellContent = `
                    <div class="counter">${count}</div>
                    ${noPlans > 0 ? `<div class="alert-badge" title="${noPlans} risco(s) requer(em) plano de ação">${noPlans}</div>` : ""}
                    ${overdue > 0 ? `<div class="overdue-badge" title="${overdue} risco(s) com análise atrasada">${overdue}</div>` : ""}
                `;
            }

            html += `<td class="risk-cell${cellSelectedClass}"
                data-prob="${p}" data-imp="${imp}"
                style="background-color:${cellColor}; --border-color:${borderColor};"
                title="${tooltip}">
                    ${cellContent}
                </td>`;
        }
        html += `</tr>`;
    }
    html += `</table>
    </div>`;

    if (!isDrawerMatrix) {
        html += `
        <div class="size-controls">
             <button class="legend-button" title="Registro de Riscos&#013;⚠️ Total de Riscos&#013;📄 Somente Documentados&#013;Células da Matriz&#013;⚪ Riscos na célula&#013;🔴 Riscos sem planos de ação&#013;🟠 Riscos com prazo ultrapassado&#013;Graus de Risco&#013;🟦 Muito Baixo&#013;🟩 Baixo&#013;🟨 Moderado&#013;🟧 Elevado&#013;🟥 Extremo">Legenda</button>
             <div>
                 <button class="size-btn" id="btn-matrix-decrease" title="Diminuir células">−</button>
                 <button class="size-btn" id="btn-matrix-increase" title="Aumentar células">+</button>
             </div>
         </div>`;
    }

    container.innerHTML = html;

    // Adiciona listeners
    container.querySelectorAll('.matrix-header, .risk-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
             const targetCell = e.currentTarget;
             let prob = targetCell.dataset.prob === 'null' ? null : parseInt(targetCell.dataset.prob, 10);
             let imp = targetCell.dataset.imp === 'null' ? null : parseInt(targetCell.dataset.imp, 10);
             if (onCellClickCallback) {
                 onCellClickCallback(prob, imp);
             }
        });
    });
    
    if (!isDrawerMatrix) {
        document.getElementById('btn-matrix-decrease')?.addEventListener('click', () => adjustSize(-6));
        document.getElementById('btn-matrix-increase')?.addEventListener('click', () => adjustSize(6));
    }

    // Desenha trajeto SVG
    if (isEvolutionMode && evolutionSteps.length > 1) {
        requestAnimationFrame(() => {
            drawEvolutionPath(evolutionSteps, container);
        });
    }
}

/** Desenha a linha SVG conectando os passos de evolução do risco */
function drawEvolutionPath(steps, container) {
    const wrapper = container.querySelector('.matrix-wrapper');
    if (!wrapper) return;
    
    let svg = wrapper.querySelector('#evolution-svg-overlay');
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('id', 'evolution-svg-overlay');
        wrapper.appendChild(svg);
    } else {
        svg.innerHTML = '';
    }

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <marker id="arrow" viewBox="0 0 10 10" refX="14" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#3b82f6" />
        </marker>
    `;
    svg.appendChild(defs);

    const rectWrapper = wrapper.getBoundingClientRect();

    for (let i = 0; i < steps.length - 1; i++) {
        const startEl = wrapper.querySelector(`.evolution-step-marker[data-step-index="${i}"]`);
        const endEl = wrapper.querySelector(`.evolution-step-marker[data-step-index="${i+1}"]`);
        
        if (startEl && endEl) {
            const rectStart = startEl.getBoundingClientRect();
            const rectEnd = endEl.getBoundingClientRect();

            const x1 = rectStart.left + rectStart.width / 2 - rectWrapper.left;
            const y1 = rectStart.top + rectStart.height / 2 - rectWrapper.top;
            const x2 = rectEnd.left + rectEnd.width / 2 - rectWrapper.left;
            const y2 = rectEnd.top + rectEnd.height / 2 - rectWrapper.top;

            const dist = Math.hypot(x2 - x1, y2 - y1);
            if (dist > 8) {
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', 'evolution-svg-line');
                line.setAttribute('marker-end', 'url(#arrow)');
                svg.appendChild(line);
            }
        }
    }
}

/** Ajusta o tamanho da célula da matriz */
export function adjustSize(change) {
    cellHeight = Math.max(24, Math.min(100, cellHeight + change));
    applyCellSize();
    if (window.renderAll) {
        window.renderAll();
    }
}

// Redesenha caminhos
window.addEventListener('resize', () => {
    const overlays = document.querySelectorAll('#evolution-svg-overlay');
    overlays.forEach(svg => {
        if (svg && svg.style.display !== 'none') {
            if (window.renderAll) window.renderAll();
        }
    });
});
