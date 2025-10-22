// js/main.js
import { PRIMARY_TABLE_NAME, RISK_DEPT_COLUMN } from './config.js';
import { getDeptName } from './utils.js';
import { fetchTableData } from './gristApiService.js'; // Importa se for buscar dados aqui
import { renderMatrix, adjustSize } from './matrixModule.js';
import { renderCards } from './cardsModule.js';
import { initSidePanel, openSidePanel } from './sidePanelModule.js';
import { subscribe } from '../../libraries/grist-event-bus/grist-event-bus.js';

// --- Estado Global do Widget ---
let allRiskRecords = []; // Todos os registros da tabela Riscos
let filteredRiskRecords = []; // Registros após filtro de departamento
let cardRecords = []; // Registros após filtro de matriz (para os cards)
let allDepartments = [];
let selectedDepartments = [];
let activeMatrixFilter = null; // { probability: p, impact: i } ou null
let activeMatrixHighlight = null; // { probability: p, impact: i } ou null
let externalFilter = null; // Added this line

// --- Elementos da UI ---
const filterDropdownBtn = document.getElementById('department-dropdown-btn');
const filterDropdownOptions = document.getElementById('department-dropdown-options');
const matrixContainerId = 'matrix-section';
const cardsContainerId = 'cards-section';

// --- Inicialização Grist ---
grist.ready({ requiredAccess: 'full' }); // Pedir acesso 'full'
grist.onRecords(handleGristRecords); // Chama a função quando os dados chegam/mudam

// --- Inicialização dos Módulos ---
initSidePanel(); // Configura listeners do painel lateral

// Added grf-trigger-widget subscriber
subscribe('grf-trigger-widget', (data) => {
    if (data && data.filterTargetColumn && data.filterValue) {
        externalFilter = {
            column: data.filterTargetColumn,
            value: data.filterValue
        };
        renderAll();
    }
});
console.log("DEBUG: grf-trigger-widget subscribed.");

// --- Handler de Dados Grist ---
function handleGristRecords(records, mappings) {
    console.log("Novos registros recebidos do Grist:", records);
    allRiskRecords = records || [];
    // Se precisar remapear colunas (útil se a configuração do widget muda as colunas)
    // allRiskRecords = grist.mapColumnNames(records, mappings); // Descomente se usar mapeamento

    if (!allRiskRecords || allRiskRecords.length === 0) {
        console.warn("Nenhum registro recebido ou mapeamento falhou.");
        // Limpar UI? Mostrar mensagem?
        document.getElementById(matrixContainerId).innerHTML = '<p class="loading-message">Sem dados de risco para exibir.</p>';
        document.getElementById(cardsContainerId).innerHTML = '';
        return;
    }

    // Processa os dados recebidos
    buildDepartmentsList(); // Atualiza a lista de departamentos disponíveis
    updateFilterDropdownUI(); // Atualiza o visual do dropdown
    renderAll(); // Renderiza matriz e cards com base nos dados e filtros atuais
}

// --- Lógica de Filtragem e Renderização ---

/** Função principal que aplica filtros e chama renderizadores */
function renderAll() {
    let recordsToProcess = allRiskRecords; // New variable to hold records before filtering

    // New: Apply external filter
    if (externalFilter) {
        recordsToProcess = recordsToProcess.filter(riskRecord => {
            const filterColumnValue = riskRecord[externalFilter.column];
            let isMatch = false;
            if (Array.isArray(externalFilter.value)) {
                const numericFilterValues = externalFilter.value.map(id => Number(id));
                isMatch = numericFilterValues.includes(Number(filterColumnValue));
            } else {
                isMatch = Number(filterColumnValue) === Number(externalFilter.value);
            }
            return isMatch;
        });
    }

    // 1. Filtra por Departamento
    filteredRiskRecords = recordsToProcess.filter(r => { // Changed from allRiskRecords to recordsToProcess
        if (selectedDepartments.length === 0) return true; // Sem filtro de depto = mostra todos
        let dept = getDeptName(r, RISK_DEPT_COLUMN);
        return selectedDepartments.includes(dept);
    });
    console.log(`${filteredRiskRecords.length} registros após filtro de departamento.`);

    // 2. Filtra para os Cards baseado no Filtro da Matriz
    cardRecords = [...filteredRiskRecords]; // Começa com deptos filtrados
    if (activeMatrixFilter) {
        const { probability, impact } = activeMatrixFilter;
        if (probability !== null || impact !== null) { // Apenas filtra se não for o geral (null, null)
            cardRecords = cardRecords.filter(r => {
                const p = r.ultprob || 0; // Use nome da coluna do config.js se necessário
                const i = r.ultimpac || 0;
                if (probability !== null && impact !== null) return p == probability && i == impact;
                if (probability !== null) return p == probability;
                if (impact !== null) return i == impact;
                return true; // Nunca deveria chegar aqui se um for não-nulo
            });
        }
    }
    console.log(`${cardRecords.length} registros para os cards após filtro da matriz.`);

    // 3. Renderiza a Matriz (usa dados filtrados por depto)
    renderMatrix(filteredRiskRecords, matrixContainerId, activeMatrixHighlight, activeMatrixFilter, handleMatrixCellClick); // Passa callback

    // 4. Renderiza os Cards (usa dados filtrados por depto E matriz)
    renderCards(cardRecords, cardsContainerId, handleCardClick, handleCardBurgerClick); // Passa callbacks
}
// Disponibiliza globalmente se precisar chamar de outros módulos (alternativa a eventos)
window.renderAll = renderAll;

// --- Callbacks e Handlers de Eventos ---

/** Chamado quando uma célula da matriz é clicada (via callback do matrixModule) */
function handleMatrixCellClick(prob, imp) {
    console.log(`Matrix cell click: P=${prob}, I=${imp}`);
    const currentFilter = activeMatrixFilter;
    // Desativa filtro se clicar na mesma célula/linha/coluna que já estava ativa
    if (currentFilter && currentFilter.probability === prob && currentFilter.impact === imp) {
        activeMatrixFilter = null;
    } else {
        activeMatrixFilter = { probability: prob, impact: imp };
    }
    activeMatrixHighlight = null; // Limpa highlight ao definir filtro
    renderAll();
}

/** Chamado quando um card (linha) é clicado (via callback do cardsModule) */
function handleCardClick(prob, imp) {
    console.log(`Card click: P=${prob}, I=${imp}`);
    activeMatrixHighlight = { probability: prob, impact: imp };
    // Não altera o filtro principal, apenas re-renderiza para highlight
    renderMatrix(filteredRiskRecords, matrixContainerId, activeMatrixHighlight, activeMatrixFilter, handleMatrixCellClick); // Só re-renderiza a matriz
}

/** Chamado quando o ícone de hambúrguer de um card é clicado (via callback) */
function handleCardBurgerClick(riskId) {
     console.log(`Burger click: Risk ID=${riskId}`);
     const riskRecord = allRiskRecords.find(r => r.id === riskId);
     if (riskRecord) {
        openSidePanel(riskRecord); // Chama a função do módulo do painel
     } else {
        console.error(`Risco com ID ${riskId} não encontrado em allRiskRecords.`);
        // Mostrar erro para o usuário?
     }
}


// --- Lógica do Filtro de Departamento ---

function buildDepartmentsList() {
    const deptSet = new Set();
    allRiskRecords.forEach(r => {
        let dept = getDeptName(r, RISK_DEPT_COLUMN); // Usa a função utils
        if (dept && dept !== "SEM DEPTO" && !dept.startsWith("DEPTO ID")) {
            deptSet.add(dept);
        }
    });
     // Adiciona "SEM DEPARTAMENTO" se houver riscos assim
     if (allRiskRecords.some(r => getDeptName(r, RISK_DEPT_COLUMN) === "SEM DEPTO")) {
          deptSet.add("SEM DEPTO");
     }
    allDepartments = Array.from(deptSet).sort((a, b) => a.localeCompare(b));
    // Mantém seleções existentes se possível
    selectedDepartments = selectedDepartments.filter(d => allDepartments.includes(d));
    console.log("Departamentos encontrados:", allDepartments);
}

function updateFilterDropdownUI() {
    updateDropdownOptions(); // Atualiza checkboxes
    updateDropdownButton(); // Atualiza cards no botão
}

function updateDropdownOptions() {
    if (!filterDropdownOptions) return;
    filterDropdownOptions.innerHTML = "";
    allDepartments.forEach(dept => {
        addDeptOption(filterDropdownOptions, dept);
    });
    if (filterDropdownOptions.innerHTML === "") {
        filterDropdownOptions.innerHTML = "<div style='padding: 5px; color: #888;'>N/D</div>";
    }
}

function addDeptOption(container, dept) {
    const isSelected = selectedDepartments.includes(dept);
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = dept;
    checkbox.checked = isSelected;
    checkbox.onchange = (e) => { // Usa onchange em vez de addEventListener para simplicidade na edição GitHub
        e.stopPropagation();
        if (checkbox.checked) {
            if (!selectedDepartments.includes(dept)) selectedDepartments.push(dept);
        } else {
            selectedDepartments = selectedDepartments.filter(d => d !== dept);
        }
        selectedDepartments.sort((a, b) => a.localeCompare(b));
        updateDropdownButton();
        renderAll(); // Re-renderiza tudo com o novo filtro
    };
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + dept));
    container.appendChild(label);
}

function updateDropdownButton() {
    if (!filterDropdownBtn) return;
    if (selectedDepartments.length === 0) {
        filterDropdownBtn.innerHTML = `<span style="color: #777;">Todos Departamentos</span>`;
    } else {
        filterDropdownBtn.innerHTML = selectedDepartments.map(dept => (
            `<div class="department-card">
               ${dept}
               <span class="remove-btn" data-dept="${dept}">×</span>
             </div>`
        )).join("");
         // Adiciona listener para botões de remover DEPOIS de criar o HTML
         filterDropdownBtn.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = (e) => { // Usa onclick para simplicidade
                 e.stopPropagation();
                 removeDepartment(btn.dataset.dept);
            };
         });
    }
}

function removeDepartment(dept) {
    selectedDepartments = selectedDepartments.filter(d => d !== dept);
    updateFilterDropdownUI(); // Atualiza botão e opções
    renderAll();
}

function selectAllDepts() {
    selectedDepartments = [...allDepartments];
    updateFilterDropdownUI();
    renderAll();
}
function removeAllDepts() {
    selectedDepartments = [];
    updateFilterDropdownUI();
    renderAll();
}

// --- Listeners Globais / UI Principal ---
filterDropdownBtn?.addEventListener('click', (e) => {
    if (filterDropdownOptions) {
        const isOpen = filterDropdownOptions.style.display === "block";
        filterDropdownOptions.style.display = isOpen ? "none" : "block";
    }
    e.stopPropagation();
});

document.addEventListener('click', (e) => {
    // Fecha dropdown se clicar fora
    const dropdown = document.getElementById('department-dropdown');
    if (filterDropdownOptions && filterDropdownOptions.style.display === 'block' && dropdown && !dropdown.contains(e.target)) {
        filterDropdownOptions.style.display = 'none';
    }
});

// Botões do filtro
document.getElementById('btn-select-all-depts')?.addEventListener('click', selectAllDepts);
document.getElementById('btn-remove-all-depts')?.addEventListener('click', removeAllDepts);

console.log("Widget principal inicializado.");
