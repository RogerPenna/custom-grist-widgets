// js/main.js
import { 
    setWidgetConfig, 
    getTableId, 
    getAnalysesTableId, 
    getColumnKey 
} from './config.js';
import { getDeptName } from './utils.js';
import { findAnalysisLinkingColumn, fetchAllAnalyses, filterAnalysesForRisk } from './gristApiService.js';
import { renderMatrix, adjustSize } from './matrixModule.js';
import { initSidePanel, openSidePanel } from './sidePanelModule.js';
import { subscribe } from '../../libraries/grist-event-bus/grist-event-bus.js';
import { TableRenderer } from '../../libraries/grist-table-renderer/TableRenderer.js';
import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../../libraries/grist-config-manager/ConfigManagerComponent.js';
import { GristLauncherUtils } from '../../libraries/grist-launcher-utils.js';
import { openDrawer } from '../../libraries/grist-drawer-component/drawer-component.js';
import { CardSystem } from '../../libraries/grist-card-system/CardSystem.js';

// --- Estado Global do Widget ---
let allRiskRecords = []; // Todos os registros da tabela Riscos
let filteredRiskRecords = []; // Registros após filtro de departamento
let allDepartments = [];
let selectedDepartments = [];
let activeMatrixFilter = null; // { probability: p, impact: i } ou null
let activeMatrixHighlight = null; // { probability: p, impact: i } ou null
let externalFilter = null;

// --- Configurações Grist ---
let currentConfigId = null;
let currentConfig = null;
let isInitialized = false;
let activeRenderId = 0;

// --- Instâncias do Grist Lens ---
const tableLens = new GristTableLens(grist);

// --- Elementos da UI ---
const filterDropdownBtn = document.getElementById('department-dropdown-btn');
const filterDropdownOptions = document.getElementById('department-dropdown-options');
const matrixContainerId = 'matrix-section';

// --- Instâncias Globais de Gráficos (Chart.js) ---
let chartDeptInstance = null;
let chartTratamentoInstance = null;
let chartGrauInstance = null;

// --- Getters Dinâmicos de Colunas ---
const getColIdRisco = () => getColumnKey('IDRisco', 'idRiscoField');
const getColNomeRisco = () => getColumnKey('NomeRisco', 'nomeRiscoField');
const getColDepto = () => getColumnKey('Departamento', 'deptoField');
const getColProb = () => getColumnKey('ultprob', 'probField');
const getColImpact = () => getColumnKey('ultimpac', 'impactField');
const getColInherentProb = () => getColumnKey('Probabilidade_Inerente_Num', 'inherentProbField');
const getColInherentImpact = () => getColumnKey('Impacto_Inerente_Num', 'inherentImpactField');
const getColPAs = () => getColumnKey('PAs', 'pasField');
const getColNextAnalise = () => getColumnKey('DataProxAnalise', 'nextAnaliseField');
const getColDescricao = () => getColumnKey('Descricao', 'descricaoField');
const getColTratamento = () => getColumnKey('Ultimo_Tratamento', 'tratamentoField');

// --- Inicialização Grist ---
grist.ready({ requiredAccess: 'full' });

// Registra ouvintes IMEDIATAMENTE para evitar perdas de eventos de mensagens
grist.onRecords(handleGristRecords);

// Escuta mudanças de opções/configurações da Grist
grist.onOptions(async (options) => {
    console.log("Evento onOptions disparado. Opções recebidas:", options);
    const newConfigId = options?.configId || null;
    if (newConfigId !== currentConfigId || !isInitialized) {
        isInitialized = true;
        currentConfigId = newConfigId;
        await initializeAndUpdate();
    }
});

// Fallback para carregamento fora do iframe do Grist (standalone)
setTimeout(() => {
    if (!isInitialized) {
        console.log("Grist: Usando fallback de inicialização standalone.");
        isInitialized = true;
        initializeAndUpdate();
    }
}, 1200);

// Carrega os ícones SVG globais para uso na engrenagem sem bloquear o fluxo principal
async function loadIcons() {
    try {
        const response = await fetch('../libraries/icons/icons.svg');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const svgText = await response.text();
        const div = document.createElement('div');
        div.style.display = 'none';
        div.innerHTML = svgText;
        document.body.insertBefore(div, document.body.firstChild);
    } catch (error) {
        console.error('Falha ao carregar o arquivo de ícones:', error);
    }
}
loadIcons().catch(err => console.error("Erro no carregamento assíncrono de ícones:", err));

// Inicializa a engrenagem e busca a configuração salva
async function initializeAndUpdate(bypassCache = false) {
    if (currentConfigId) {
        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId, { bypassCache });
        } catch (e) {
            console.error("Erro ao carregar configuração Grist:", e);
        }
    } else {
        currentConfig = null;
    }
    setWidgetConfig(currentConfig); // Salva globalmente em config.js
    addSettingsGear();
    renderAll();
}

// Cria o botão da engrenagem de configuração no canto inferior esquerdo (dentro do tab-nav)
function addSettingsGear() {
    if (document.getElementById('settings-gear-btn')) return;
    const tabNav = document.querySelector('.main-tabs-nav');
    if (!tabNav) {
        // Fallback para append no body caso a barra não exista por algum motivo
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = `<svg style="width:18px; height:18px; fill:currentColor;"><use href="#icon-settings"></use></svg>`;
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
        return;
    }

    if (!tabNav.querySelector('.nav-spacer')) {
        const spacer = document.createElement('div');
        spacer.className = 'nav-spacer';
        spacer.style.flexGrow = '1';
        tabNav.appendChild(spacer);
    }

    const gearBtn = document.createElement('button');
    gearBtn.id = 'settings-gear-btn';
    gearBtn.innerHTML = `<svg style="width:18px; height:18px; fill:currentColor;"><use href="#icon-settings"></use></svg>`;
    gearBtn.title = 'Configurações do Widget';
    gearBtn.onclick = openSettingsPopover;
    tabNav.appendChild(gearBtn);
}

// Abre o popover da engrenagem de configuração
async function openSettingsPopover(event) {
    event.stopPropagation();
    await GristLauncherUtils.renderSettingsPopover({
        grist: window.grist,
        tableLens,
        currentConfigId,
        currentConfig,
        onLink: async (newId) => {
            await grist.setOptions({ configId: newId || null });
            currentConfigId = newId || null;
            await initializeAndUpdate(true);
        },
        onOpenManager: () => {
            openConfigManager(grist, { initialConfigId: currentConfigId });
        }
    });
}

// --- Inicialização dos Módulos ---
initSidePanel();
setupClickExpansions();

// --- Lógica de Abas Principais ---
const mainTabButtons = document.querySelectorAll('.main-tab-button');
const mainTabContents = document.querySelectorAll('.main-tab-content');
let activeMainTab = 'geral';

mainTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-main-tab');
        activeMainTab = target;
        
        mainTabButtons.forEach(b => b.classList.toggle('active', b === btn));
        mainTabContents.forEach(c => c.classList.toggle('active', c.id === `tab-content-${target}`));
        
        renderAll();
    });
});

// Evento de filtro externo
subscribe('grf-trigger-widget', (data) => {
    if (data && data.filterTargetColumn && data.filterValue) {
        externalFilter = {
            column: data.filterTargetColumn,
            value: data.filterValue,
            disableFiltering: data.disableFiltering
        };
        renderAll();
    }
});

// --- Handler de Dados Grist ---
async function handleGristRecords(records, mappings) {
    console.log("Novos registros recebidos do Grist:", records);
    allRiskRecords = records || [];
    if (allRiskRecords.length > 0) {
        const tableId = getTableId();
        allRiskRecords.forEach(r => {
            r.gristHelper_tableId = tableId;
        });
    }

    if (!allRiskRecords || allRiskRecords.length === 0) {
        console.warn("Nenhum registro recebido ou mapeamento falhou.");
        document.getElementById(matrixContainerId).innerHTML = '<p class="loading-message">Sem dados de risco para exibir.</p>';
        document.getElementById('table-container').innerHTML = '<p class="loading-message">Sem dados de risco para exibir.</p>';
        return;
    }

    try {
        await findAnalysisLinkingColumn();
        await fetchAllAnalyses();
    } catch (e) {
        console.warn("Erro ao pré-buscar histórico de análises:", e);
    }

    buildDepartmentsList();
    updateFilterDropdownUI();
    renderAll();
}

// --- Lógica de Filtragem e Renderização ---

function renderAll() {
    // Garante que todos os registros tenham o tableId correto mapeado para resolução de referências
    const currentTableId = getTableId();
    if (allRiskRecords && allRiskRecords.length > 0) {
        allRiskRecords.forEach(r => {
            r.gristHelper_tableId = currentTableId;
        });
    }

    let recordsToProcess = [...allRiskRecords]; 

    // Aplicar Filtro Externo
    if (externalFilter && externalFilter.column && externalFilter.value !== undefined && externalFilter.value !== null && !externalFilter.disableFiltering) {
        recordsToProcess = recordsToProcess.filter(riskRecord => {
            const rawVal = riskRecord[externalFilter.column];
            const recordValues = Array.isArray(rawVal) ? (rawVal[0] === 'L' ? rawVal.slice(1) : rawVal) : [rawVal];
            const filterValues = Array.isArray(externalFilter.value) ? externalFilter.value : [externalFilter.value];

            return recordValues.some(v => filterValues.some(fv => {
                if (!isNaN(v) && !isNaN(fv)) return Number(v) === Number(fv);
                return String(v) === String(fv);
            }));
        });
    }

    // Filtra por Departamento
    filteredRiskRecords = recordsToProcess.filter(r => {
        if (selectedDepartments.length === 0) return true;
        let dept = getDeptName(r, getColDepto());
        return selectedDepartments.includes(dept);
    });

    // Renderizar Abas
    if (activeMainTab === 'geral') {
        renderGeralTab();
    } else if (activeMainTab === 'dashboard') {
        renderDashboardTab();
    }
}
window.renderAll = renderAll;

/** Renderiza a tela de Visão Geral (Matriz + Tabela lado a lado) */
function renderGeralTab() {
    // Define a largura padrão configurada pelo usuário se ainda não interagiu
    const matrixSecEl = document.getElementById('matrix-section');
    if (matrixSecEl && !matrixSecEl.dataset.isInteracted) {
        const defaultWidth = currentConfig?.styling?.matrixWidth || '30%';
        matrixSecEl.style.flex = `0 0 ${defaultWidth}`;
    }

    // 1. Renderiza a matriz
    renderMatrix(
        filteredRiskRecords, 
        matrixContainerId, 
        activeMatrixHighlight, 
        activeMatrixFilter, 
        handleMatrixCellClick
    );

    // 2. Filtra registros para a tabela baseado no filtro ativo da matriz
    let tableRecords = [...filteredRiskRecords];
    if (activeMatrixFilter) {
        const { probability, impact } = activeMatrixFilter;
        if (probability !== null || impact !== null) {
            tableRecords = tableRecords.filter(r => {
                const p = Number(r[getColProb()]) || 0;
                const i = Number(r[getColImpact()]) || 0;
                if (probability !== null && impact !== null) return p == probability && i == impact;
                if (probability !== null) return p == probability;
                if (impact !== null) return i == impact;
                return true;
            });
        }
    }

    // 3. Renderiza a tabela de riscos
    const tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        tableContainer.innerHTML = '';
        const renderId = ++activeRenderId;
        
        if (currentConfig && currentConfig.actions && currentConfig.actions.tableConfigId) {
            // Se houver uma configuração de tabela ou cards vinculada no ConfigManager, busca as configurações dela
            tableLens.fetchConfig(currentConfig.actions.tableConfigId).then(tblCfg => {
                if (renderId !== activeRenderId) return;

                // Remove debug info se existir
                const debugDiv = document.getElementById('debug-linked-config');
                if (debugDiv) debugDiv.remove();

                if (tblCfg && tblCfg.componentType === 'Card System') {
                    tableContainer.style.overflowY = 'auto';
                    tableContainer.style.overflowX = 'hidden';
                    tableContainer.style.display = 'block';
                    tableLens.getTableSchema(tblCfg.tableId || getTableId()).then(async schema => {
                        if (renderId !== activeRenderId) return;

                        // Remove debug schema info se existir
                        const debugDiv2 = document.getElementById('debug-schema-record');
                        if (debugDiv2) debugDiv2.remove();

                        try {
                            const showAddTop = tblCfg.showAddButtonTop || (tblCfg.actions && tblCfg.actions.enableAddNewBtn);
                            const showAddBottom = tblCfg.showAddButtonBottom;

                            if (showAddTop) {
                                tableContainer.appendChild(createCardsAddButton('static-top', tblCfg));
                            }

                            const cardsWrapper = document.createElement('div');
                            cardsWrapper.className = 'cards-wrapper';
                            cardsWrapper.style.width = '100%';
                            tableContainer.appendChild(cardsWrapper);

                            await CardSystem.renderCards(cardsWrapper, tableRecords, {
                                ...tblCfg,
                                tableLens: tableLens,
                                isEmbedded: true
                            }, schema);

                            if (renderId !== activeRenderId) return;

                            if (showAddBottom) {
                                tableContainer.appendChild(createCardsAddButton('static-bottom', tblCfg));
                            }
                        } catch (renderErr) {
                            if (renderId !== activeRenderId) return;
                            console.error("Erro ao renderizar cards:", renderErr);
                            tableContainer.style.overflow = 'hidden';
                            tableContainer.style.display = '';
                            renderTableComponent(tableContainer, tableRecords, tblCfg);
                            const errDiv = document.createElement('div');
                            errDiv.style.color = 'red';
                            errDiv.style.padding = '10px';
                            errDiv.innerText = "Erro ao renderizar cards: " + renderErr.message + "\nStack: " + renderErr.stack;
                            tableContainer.appendChild(errDiv);
                        }
                    }).catch(err => {
                        if (renderId !== activeRenderId) return;
                        console.error("Erro ao carregar schema de cards. Usando fallback tabela.", err);
                        tableContainer.style.overflow = 'hidden';
                        tableContainer.style.display = '';
                        renderTableComponent(tableContainer, tableRecords, tblCfg);
                        const errDiv = document.createElement('div');
                        errDiv.style.color = 'red';
                        errDiv.style.padding = '10px';
                        errDiv.innerText = "Erro ao carregar schema de cards: " + err.message;
                        tableContainer.appendChild(errDiv);
                    });
                } else {
                    tableContainer.style.overflow = 'hidden';
                    tableContainer.style.display = '';
                    renderTableComponent(tableContainer, tableRecords, tblCfg || currentConfig);
                }
            }).catch(e => {
                if (renderId !== activeRenderId) return;
                console.error("Erro ao buscar tabela vinculada. Usando fallback.", e);
                tableContainer.style.overflow = 'hidden';
                tableContainer.style.display = '';
                renderTableComponent(tableContainer, tableRecords, currentConfig);
            });
        } else {
            tableContainer.style.overflow = 'hidden';
            tableContainer.style.display = '';
            // Fallback para as colunas mapeadas padrão
            const defaultTableConfig = {
                tableId: getTableId(),
                columns: [
                    { colId: getColIdRisco(), title: "Código", width: 75, align: "left" },
                    { colId: getColNomeRisco(), title: "Título de Risco", align: "left" },
                    { colId: getColDepto(), title: "Departamento", width: 140, align: "left" },
                    { colId: getColProb(), title: "Prob", width: 70, align: "center" },
                    { colId: getColImpact(), title: "Impacto", width: 70, align: "center" },
                    { colId: "UltimoCalcRisk", title: "Grau", width: 90, align: "center" },
                    { colId: "Ultimo_Tratamento", title: "Tratamento", width: 110, align: "center" },
                    { colId: "PAs", title: "PAs", width: 60, align: "center" },
                    { colId: "DataProxAnalise", title: "Próx. Análise", width: 110, align: "center" }
                ],
                styling: {
                    tableLayoutConfig: {
                        themeStyle: "glassmorphism",
                        density: "comfortable",
                        headerFilter: true
                    }
                },
                actions: {
                    editMode: "excel",
                    useSaveButton: false
                }
            };
            renderTableComponent(tableContainer, tableRecords, defaultTableConfig);
        }
    }
}

/** Executa o renderTable com as propriedades corretas */
function renderTableComponent(container, records, config) {
    TableRenderer.renderTable({
        container: container,
        records: records,
        config: config,
        tableLens: tableLens,
        onRowClick: (record) => {
            // Conexão de dupla via: clica na tabela destaca a célula da matriz
            handleTableRowClick(record);
            
            // Abre o Drawer customizado ou o nativo dependendo da configuração
            if (currentConfig && currentConfig.actions && currentConfig.actions.drawerConfigId) {
                tableLens.fetchConfig(currentConfig.actions.drawerConfigId).then(drawerCfg => {
                    openDrawer(getTableId(), record.id, { 
                        ...(drawerCfg || {}), 
                        tableLens, 
                        mode: 'view' 
                    });
                }).catch(e => {
                    console.error("Erro ao carregar drawer customizado. Usando fallback.", e);
                    openSidePanel(record);
                });
            } else {
                openSidePanel(record);
            }
        }
    });
}

/** Trata o clique na linha da tabela para destacar a célula na matriz */
function handleTableRowClick(record) {
    console.log("Table row clicked. Highlighting matrix cell.", record);
    const p = Number(record[getColProb()]) || 0;
    const imp = Number(record[getColImpact()]) || 0;
    if (p > 0 && imp > 0) {
        activeMatrixHighlight = { probability: p, impact: imp };
        // Re-renderiza a matriz com o highlight ativo
        renderMatrix(
            filteredRiskRecords, 
            matrixContainerId, 
            activeMatrixHighlight, 
            activeMatrixFilter, 
            handleMatrixCellClick
        );
    }
}

/** Renderiza a Aba de Dashboard e Gráficos */
function renderDashboardTab() {
    // 1. Riscos por Departamento
    const deptCounts = {};
    allRiskRecords.forEach(r => {
        let dept = getDeptName(r, getColDepto());
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    // 2. Riscos por Tratamento
    const tratCounts = {};
    allRiskRecords.forEach(r => {
        let trat = r[getColTratamento()] || r.Tratamento || "Não Definido";
        tratCounts[trat] = (tratCounts[trat] || 0) + 1;
    });

    // 3. Riscos por Grau/Criticidade
    const criticidadeCounts = {
        'Muito Baixo': 0,
        'Baixo': 0,
        'Moderado': 0,
        'Elevado': 0,
        'Extremo': 0
    };
    allRiskRecords.forEach(r => {
        const p = Number(r[getColProb()]) || 0;
        const imp = Number(r[getColImpact()]) || 0;
        const score = Number(r.UltimoCalcRisk || (p * imp)) || 0;
        if (score <= 2) criticidadeCounts['Muito Baixo']++;
        else if (score <= 5) criticidadeCounts['Baixo']++;
        else if (score <= 10) criticidadeCounts['Moderado']++;
        else if (score <= 16) criticidadeCounts['Elevado']++;
        else criticidadeCounts['Extremo']++;
    });

    // Destrói gráficos anteriores para recriar
    if (chartDeptInstance) chartDeptInstance.destroy();
    if (chartTratamentoInstance) chartTratamentoInstance.destroy();
    if (chartGrauInstance) chartGrauInstance.destroy();

    // Gráfico 1: Departamentos (Bar)
    const ctxDept = document.getElementById('chart-dept').getContext('2d');
    chartDeptInstance = new Chart(ctxDept, {
        type: 'bar',
        data: {
            labels: Object.keys(deptCounts),
            datasets: [{
                label: 'Quantidade de Riscos',
                data: Object.values(deptCounts),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // Gráfico 2: Tratamentos (Doughnut)
    const ctxTrat = document.getElementById('chart-tratamento').getContext('2d');
    chartTratamentoInstance = new Chart(ctxTrat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(tratCounts),
            datasets: [{
                data: Object.values(tratCounts),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Gráfico 3: Grau de Risco (Pie)
    const ctxGrau = document.getElementById('chart-grau').getContext('2d');
    chartGrauInstance = new Chart(ctxGrau, {
        type: 'pie',
        data: {
            labels: Object.keys(criticidadeCounts),
            datasets: [{
                data: Object.values(criticidadeCounts),
                backgroundColor: ['#157AFB', '#2AE028', '#E8D62F', '#FD9D28', '#E00A17'] // Cores originais do usuário
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// --- Callbacks e Handlers de Eventos ---

function handleMatrixCellClick(prob, imp) {
    console.log(`Matrix cell click: P=${prob}, I=${imp}`);
    const currentFilter = activeMatrixFilter;
    if (currentFilter && currentFilter.probability === prob && currentFilter.impact === imp) {
        activeMatrixFilter = null;
    } else {
        activeMatrixFilter = { probability: prob, impact: imp };
    }
    activeMatrixHighlight = null;
    renderAll();
}

// --- Lógica do Filtro de Departamento ---

function buildDepartmentsList() {
    const deptSet = new Set();
    allRiskRecords.forEach(r => {
        let dept = getDeptName(r, getColDepto());
        if (dept && dept !== "SEM DEPTO" && !dept.startsWith("DEPTO ID")) {
            deptSet.add(dept);
        }
    });
     if (allRiskRecords.some(r => getDeptName(r, getColDepto()) === "SEM DEPTO")) {
          deptSet.add("SEM DEPTO");
     }
    allDepartments = Array.from(deptSet).sort((a, b) => a.localeCompare(b));
    selectedDepartments = selectedDepartments.filter(d => allDepartments.includes(d));
}

function updateFilterDropdownUI() {
    updateDropdownOptions();
    updateDropdownButton();
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
    checkbox.onchange = (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
            if (!selectedDepartments.includes(dept)) selectedDepartments.push(dept);
        } else {
            selectedDepartments = selectedDepartments.filter(d => d !== dept);
        }
        selectedDepartments.sort((a, b) => a.localeCompare(b));
        updateDropdownButton();
        renderAll();
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
         filterDropdownBtn.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                 e.stopPropagation();
                 removeDepartment(btn.dataset.dept);
            };
         });
    }
}

function removeDepartment(dept) {
    selectedDepartments = selectedDepartments.filter(d => d !== dept);
    updateFilterDropdownUI();
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

filterDropdownBtn?.addEventListener('click', (e) => {
    if (filterDropdownOptions) {
        const isOpen = filterDropdownOptions.style.display === "block";
        filterDropdownOptions.style.display = isOpen ? "none" : "block";
    }
    e.stopPropagation();
});

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('department-dropdown');
    if (filterDropdownOptions && filterDropdownOptions.style.display === 'block' && dropdown && !dropdown.contains(e.target)) {
        filterDropdownOptions.style.display = 'none';
    }
});

document.getElementById('btn-select-all-depts')?.addEventListener('click', selectAllDepts);
document.getElementById('btn-remove-all-depts')?.addEventListener('click', removeAllDepts);

// --- Lógica de clique para expandir e encolher Matriz/Tabela ---
function setupClickExpansions() {
    const matrixSecEl = document.getElementById('matrix-section');
    const tableContEl = document.getElementById('table-container');

    matrixSecEl?.addEventListener('click', (e) => {
        // Ignora se o clique for em botões de controle de tamanho, legenda, etc.
        if (e.target.closest('.size-controls') || e.target.closest('.legend-button') || e.target.closest('.size-btn')) return;
        
        if (matrixSecEl.style.flex !== "0 0 50%") {
            console.log("Expanding matrix width to 50%");
            matrixSecEl.style.flex = "0 0 50%";
            matrixSecEl.dataset.isInteracted = "true";
            
            // Redesenha caminhos da matriz após a animação de flex terminar (300ms)
            setTimeout(() => {
                renderGeralTab();
            }, 310);
        }
    });


    tableContEl?.addEventListener('click', (e) => {
        // Ignora cliques que sejam ações específicas como cliques em linhas da tabela ou cabeçalhos
        if (e.target.closest('.remove-btn') || e.target.closest('.tabulator-row')) return;
        
        const defaultWidth = currentConfig?.styling?.matrixWidth || '30%';
        if (matrixSecEl && matrixSecEl.style.flex !== `0 0 ${defaultWidth}`) {
            console.log(`Restoring matrix width to default ${defaultWidth}`);
            matrixSecEl.style.flex = `0 0 ${defaultWidth}`;
            matrixSecEl.dataset.isInteracted = "true";
            
            // Redesenha caminhos da matriz após a animação de flex terminar (300ms)
            setTimeout(() => {
                renderGeralTab();
            }, 310);
        }
    });
}

// --- Inscrição para clique em Cards ---
subscribe('grf-card-clicked', (data) => {
    const { record } = data;
    if (record) {
        handleTableRowClick(record);
        if (currentConfig && currentConfig.actions && currentConfig.actions.drawerConfigId) {
            tableLens.fetchConfig(currentConfig.actions.drawerConfigId).then(drawerCfg => {
                openDrawer(getTableId(), record.id, { 
                    ...(drawerCfg || {}), 
                    tableLens, 
                    mode: 'view' 
                });
            }).catch(e => {
                console.error("Erro ao carregar drawer customizado. Usando fallback.", e);
                openSidePanel(record);
            });
        } else {
            openSidePanel(record);
        }
    }
});

function createCardsAddButton(position, tblCfg) {
    const btn = document.createElement('button');
    btn.className = `grf-global-add-btn pos-${position}`;
    btn.title = "Adicionar Novo Registro";
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:3;"><path d="M12 5V19M5 12H19" stroke="currentColor"/></svg>`;
    btn.onclick = async (e) => {
        e.stopPropagation();
        
        let addConfig = tblCfg;
        const specificConfigId = tblCfg.addRecordConfigId || tblCfg.actions?.addRecordConfigId;
        if (specificConfigId) {
            try {
                const rec = await tableLens.findRecord('Grf_config', { configId: specificConfigId });
                if (rec) addConfig = tableLens.parseConfigRecord(rec);
            } catch (err) {
                console.error("Erro ao carregar config de adição de registro:", err);
            }
        }

        openDrawer(tblCfg.tableId || getTableId(), 'new', { ...addConfig, tableLens });
    };
    return btn;
}

console.log("Widget principal inicializado com TableRenderer e Dashboard.");
