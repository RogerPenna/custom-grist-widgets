import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../../libraries/grist-data-writer.js';

document.addEventListener('DOMContentLoaded', async () => {
    let allDeliveries = [];
    let suppliers = new Map();
    let supplierDataMap = new Map();
    let chartInstances = {};
    let fornecedoresGlobal = [];
    let materiaisGlobal = [];
    let lens;
    let dataWriter;
    let classificacaoRecords;

    try {
        await grist.ready();
        lens = new GristTableLens(grist);
        dataWriter = new GristDataWriter(grist);
    } catch (e) {
        console.error("Error during Grist initialization:", e);
        return;
    }

    async function initialize() {
        const filterBarContainer = document.getElementById('filter-bar');
        if (filterBarContainer) {
            try {
                const response = await fetch('filter-bar.html');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                filterBarContainer.innerHTML = await response.text();
            } catch (error) {
                console.error('Error loading filter bar:', error);
            }
        }

        try {
            const [deliveries, fornecedores, classificacoes, materiais] = await Promise.all([
                lens.fetchTableRecords('Dados'),
                lens.fetchTableRecords('Fornecedores'),
                lens.fetchTableRecords('Classificacao_Fornecedores'),
                lens.fetchTableRecords('Tipos_de_Fornecedores')
            ]);
            allDeliveries = deliveries;
            classificacaoRecords = classificacoes;
            fornecedoresGlobal = fornecedores;
            materiaisGlobal = materiais;

            // Mapeia os dados dos fornecedores incluindo o campo Mat_Controlado
            supplierDataMap = new Map(fornecedores.map(f => {
                let isControlled = false;
                if (Array.isArray(f.Mat_Controlado)) {
                    isControlled = f.Mat_Controlado.slice(1).some(val => val === true || val === 1);
                } else {
                    isControlled = f.Mat_Controlado === true || f.Mat_Controlado === 1;
                }
                return [f.id, {
                    nome: f.Nome_Fornecedor || 'Fornecedor Desconhecido',
                    controlado: isControlled
                }];
            }));

            allDeliveries.forEach(d => {
                const sData = supplierDataMap.get(d.Emitente) || { nome: 'Fornecedor Desconhecido', controlado: false };
                d.Emitente_Nome_Fornecedor = sData.nome;
                d.jsDate = new Date(d.Emissao * 1000);
                d.jsYear = d.jsDate.getFullYear();
            });

        } catch (error) {
            console.error("Error fetching initial data:", error);
            const container = document.getElementById('dashboard-container');
            if(container) container.innerHTML = `<p class="error-msg">Erro ao carregar dados.</p>`;
            return;
        }

        processDeliveries();
        populateFilters();
        await renderDashboard(classificacaoRecords);
        setupFilterListeners(classificacaoRecords);
        setupMainTabs();
        initConfigTab();
    }
    
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function setupMainTabs() {
        const tabSuppliersBtn = document.getElementById('tab-suppliers-btn');
        const tabChartsBtn = document.getElementById('tab-charts-btn');
        const tabConfigBtn = document.getElementById('tab-config-btn');
        const tabSuppliers = document.getElementById('tab-suppliers');
        const tabCharts = document.getElementById('tab-charts');
        const tabConfig = document.getElementById('tab-config');

        if (tabSuppliersBtn && tabChartsBtn && tabConfigBtn) {
            tabSuppliersBtn.addEventListener('click', () => {
                tabSuppliersBtn.classList.add('active');
                tabChartsBtn.classList.remove('active');
                tabConfigBtn.classList.remove('active');
                tabSuppliers.classList.add('active');
                tabCharts.classList.remove('active');
                tabConfig.classList.remove('active');
            });

            tabChartsBtn.addEventListener('click', () => {
                tabChartsBtn.classList.add('active');
                tabSuppliersBtn.classList.remove('active');
                tabConfigBtn.classList.remove('active');
                tabCharts.classList.add('active');
                tabSuppliers.classList.remove('active');
                tabConfig.classList.remove('active');
                renderChartsTab();
            });

            tabConfigBtn.addEventListener('click', () => {
                tabConfigBtn.classList.add('active');
                tabSuppliersBtn.classList.remove('active');
                tabChartsBtn.classList.remove('active');
                tabConfig.classList.add('active');
                tabSuppliers.classList.remove('active');
                tabCharts.classList.remove('active');
                // Inicializa os dados da aba de config
                populateConfigMaterials();
                populateConfigSuppliersChecklist();
                populateConfigIndividualSupplierSelect();
                updateIndividualPanel();
            });
        }

        // Ouvintes de filtros para a aba de gráficos
        const chartsAnalysisType = document.getElementById('charts-analysis-type');
        const chartsObraFilter = document.getElementById('charts-obra-filter');
        const chartsPerfView = document.getElementById('charts-perf-view');
        const chartsQualView = document.getElementById('charts-qual-view');

        if (chartsAnalysisType) {
            chartsAnalysisType.addEventListener('change', (e) => {
                const analysisType = e.target.value;
                document.getElementById('charts-perf-view-group').style.display = analysisType === 'performance' ? 'flex' : 'none';
                document.getElementById('charts-qual-view-group').style.display = analysisType === 'quality' ? 'flex' : 'none';
                renderChartsTab();
            });
        }
        if (chartsObraFilter) chartsObraFilter.addEventListener('change', renderChartsTab);
        if (chartsPerfView) chartsPerfView.addEventListener('change', renderChartsTab);
        if (chartsQualView) chartsQualView.addEventListener('change', renderChartsTab);

        // Atualizar gráficos quando mudar o filtro de ano do painel principal
        const mainYearFilter = document.getElementById('year-filter');
        if (mainYearFilter) {
            mainYearFilter.addEventListener('change', () => {
                if (tabCharts && tabCharts.classList.contains('active')) {
                    renderChartsTab();
                }
            });
        }
        
        // Atualizar gráficos quando mudar o filtro de materiais controlados do painel principal
        const controladoFilter = document.getElementById('controlado-filter');
        if (controladoFilter) {
            controladoFilter.addEventListener('change', () => {
                if (tabCharts && tabCharts.classList.contains('active')) {
                    renderChartsTab();
                }
            });
        }
    }

    function setupFilterListeners(classificacaoRecords) {
        const debouncedRender = debounce(() => renderDashboard(classificacaoRecords), 300);
        document.getElementById('search-input').addEventListener('input', debouncedRender);
        document.getElementById('obra-filter-input').addEventListener('input', debouncedRender);
        document.getElementById('obra-only-filter').addEventListener('change', () => renderDashboard(classificacaoRecords));
        document.getElementById('year-filter').addEventListener('change', () => renderDashboard(classificacaoRecords));
        document.getElementById('sort-order').addEventListener('change', () => renderDashboard(classificacaoRecords));
        
        // Novo filtro de material controlado
        const controladoFilter = document.getElementById('controlado-filter');
        if (controladoFilter) {
            controladoFilter.addEventListener('change', () => renderDashboard(classificacaoRecords));
        }
    }

    function processDeliveries() {
        suppliers.clear();
        allDeliveries.forEach(delivery => {
            const supplierId = delivery.Emitente;
            if (!suppliers.has(supplierId)) {
                const sData = supplierDataMap.get(supplierId) || { nome: 'Fornecedor Desconhecido', controlado: false };
                suppliers.set(supplierId, {
                    id: supplierId,
                    name: sData.nome,
                    controlado: sData.controlado,
                    deliveries: []
                });
            }
            suppliers.get(supplierId).deliveries.push(delivery);
        });
    }

    function populateFilters() {
        const obraDatalist = document.getElementById('obra-list');
        const yearFilter = document.getElementById('year-filter');
        const obras = [...new Set(allDeliveries.map(d => d.Obra_Local))].sort();
        const years = [...new Set(allDeliveries.map(d => d.jsYear))].sort((a, b) => b - a);
        obraDatalist.innerHTML = obras.map(o => `<option value="${o}"></option>`).join('');
        yearFilter.innerHTML = '<option value="">Todos os Anos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
            yearFilter.value = currentYear;
        }
    }

    function getStatusColor(percentage) {
    if (percentage <= 2) {
        return { bg: '#00C851', text: '#fff' }; // Green
    } else if (percentage <= 5) {
        return { bg: '#CCFF33', text: '#222' }; // Yellow-green
    } else if (percentage <= 10) {
        return { bg: '#FFEB3B', text: '#222' }; // Yellow
    } else if (percentage <= 20) {
        return { bg: '#FF9800', text: '#222' }; // Orange
    } else {
        return { bg: '#F44336', text: '#fff' }; // Red
    }
}

async function renderDashboard(classificacaoRecords) {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = '<div>Carregando...</div>';

    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedObra = document.getElementById('obra-filter-input').value;
    const obraOnly = document.getElementById('obra-only-filter').checked;
    const selectedYear = document.getElementById('year-filter').value;
    const sortOrder = document.getElementById('sort-order').value;
    
    const controladoFilter = document.getElementById('controlado-filter');
    const controladoVal = controladoFilter ? controladoFilter.value : 'controlados';

    let supplierMetrics = Array.from(suppliers.values()).map(supplier => {
        const filteredDeliveries = supplier.deliveries.filter(d => {
            const yearMatch = !selectedYear || d.jsYear === parseInt(selectedYear);
            const obraMatch = !selectedObra || d.Obra_Local === selectedObra;
            const obraOnlyMatch = !obraOnly || /^\d+$/.test(d.Obra_Local);
            return yearMatch && obraMatch && obraOnlyMatch;
        });

        if (filteredDeliveries.length === 0) return null;

        const totalDeliveries = filteredDeliveries.length;
        const nonConformingDeliveries = filteredDeliveries.filter(d => d.Insp_Recebimento !== 'A');
        const totalValue = filteredDeliveries.reduce((sum, d) => sum + d.Valor, 0);
        const nonConformingValue = nonConformingDeliveries.reduce((sum, d) => sum + d.Valor, 0);
        const nonConformingPercentage = totalDeliveries > 0 ? (nonConformingDeliveries.length / totalDeliveries) * 100 : 0;
        const nonConformingValuePercentage = totalValue > 0 ? (nonConformingValue / totalValue) * 100 : 0;

        const supplierClassifications = classificacaoRecords.filter(c => c.Fornecedor === supplier.id);

        supplierClassifications.sort((a, b) => {
            if (a.Data_Classificacao && b.Data_Classificacao) {
                return b.Data_Classificacao - a.Data_Classificacao;
            }
            if (a.Data_Classificacao) return -1;
            if (b.Data_Classificacao) return 1;
            return b.Ano - a.Ano;
        });

        const latestClassification = supplierClassifications.length > 0 ? supplierClassifications[0] : null;

        return {
            ...supplier,
            metrics: {
                totalDeliveries,
                nonConformingCount: nonConformingDeliveries.length,
                nonConformingPercentage,
                totalValue,
                nonConformingValue,
                nonConformingValuePercentage,
                classification: latestClassification
            }
        };
    }).filter(Boolean);

    // Filtra por material controlado
    if (controladoVal === 'controlados') {
        supplierMetrics = supplierMetrics.filter(s => s.controlado === true);
    } else if (controladoVal === 'nao_controlados') {
        supplierMetrics = supplierMetrics.filter(s => s.controlado === false);
    }

    if (searchTerm) {
        supplierMetrics = supplierMetrics.filter(s => s.name.toLowerCase().includes(searchTerm));
    }

    switch (sortOrder) {
        case 'most_deliveries': supplierMetrics.sort((a, b) => b.metrics.totalDeliveries - a.metrics.totalDeliveries); break;
        case 'highest_value': supplierMetrics.sort((a, b) => b.metrics.totalValue - a.metrics.totalValue); break;
        case 'most_nc_deliveries': supplierMetrics.sort((a, b) => b.metrics.nonConformingCount - a.metrics.nonConformingCount); break;
        case 'highest_nc_value': supplierMetrics.sort((a, b) => b.metrics.nonConformingValue - a.metrics.nonConformingValue); break;
        case 'highest_nc_percent': supplierMetrics.sort((a, b) => b.metrics.nonConformingPercentage - a.metrics.nonConformingPercentage); break;
        case 'highest_nc_value_percent': supplierMetrics.sort((a, b) => b.metrics.nonConformingValuePercentage - a.metrics.nonConformingValuePercentage); break;
    }

    container.innerHTML = ''; // Clear loading message
    supplierMetrics.forEach(supplier => {
        const card = document.createElement('div');
        card.className = 'supplier-card';

        const ncCountColor = getStatusColor(supplier.metrics.nonConformingPercentage);
        const ncValueColor = getStatusColor(supplier.metrics.nonConformingValuePercentage);

        let seal = '';
        let outdatedIcon = '';
        if (supplier.metrics.classification) {
            const status = supplier.metrics.classification.Status;
            const date = new Date(supplier.metrics.classification.Data_Classificacao * 1000);
            const isOutdated = (new Date() - date) > 365 * 24 * 60 * 60 * 1000;

            if (isOutdated) {
                outdatedIcon = '<span>🟠</span>';
            }

            if (status === 'Aprovado') {
                seal = `<div class="status-chip approved">🟢 Aprovado</div>`;
            } else if (status === 'Reprovado') {
                seal = `<div class="status-chip critical">🔴 Reprovado</div>`;
            } else {
                seal = `<div class="status-chip warning">⚪️ Sob observação</div>`;
            }
        }

        const badgeHtml = supplier.controlado ? `<span class="badge-controlado">Controlado</span>` : '';

        card.innerHTML = `
            <div class="card-header">
                <h3 class="supplier-name">${supplier.name}</h3>
                <div class="card-status">${badgeHtml} ${seal} ${outdatedIcon}</div>
            </div>
            <div class="card-meta">
                <div class="meta-item">
                    <span class="label">📦 Entregas</span>
                    <span class="value value-num">${supplier.metrics.totalDeliveries}</span>
                </div>
                <div class="meta-item">
                    <span class="label">💰 Valor Total</span>
                    <span class="value">${supplier.metrics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div class="meta-item">
                    <span class="label">⚠️ NC (Qtd)</span>
                    <div class="value">
                        <span class="value-num">${supplier.metrics.nonConformingCount}</span>
                        <span class="pill" style="background-color: ${ncCountColor.bg}; color: ${ncCountColor.text}">${supplier.metrics.nonConformingPercentage.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="meta-item">
                    <span class="label">⚠️ NC (Valor)</span>
                    <div class="value">
                        <span>${supplier.metrics.nonConformingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span class="pill" style="background-color: ${ncValueColor.bg}; color: ${ncValueColor.text}">${supplier.metrics.nonConformingValuePercentage.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openCustomDrawer(supplier, classificacaoRecords));
        container.appendChild(card);
    });
}

    async function openCustomDrawer(supplier, classificacaoRecords) {
        const modalHeader = `
            <div class="modal-header">
                <h3>${supplier.name}</h3>
                <span class="modal-close">&times;</span>
            </div>
        `;
        const drawerContent = `
            <div class="tabs">
                <button class="tab-link active" data-tab="tab-1">Seleção Inicial</button>
                <button class="tab-link" data-tab="tab-2">Monitoramento</button>
            </div>
            <div id="tab-1" class="tab-content active"><p>Placeholder for Seleção Inicial content.</p></div>
            <div id="tab-2" class="tab-content">
                <div id="classificacao-container"><h4>Classificações Anteriores</h4><div id="classificacao-table"></div><div id="new-classificacao-form"></div></div>
                <hr>
                <h4>Entregas</h4>
                <div class="monitoramento-filters">
                    <select id="monitoramento-year-filter"></select>
                    <input type="text" id="monitoramento-obra-filter" placeholder="Filtrar Obra...">
                    <input type="text" id="monitoramento-inspecao-filter" placeholder="Filtrar Inspeção...">
                    <select id="monitoramento-date-range-filter"><option value="">Todo o período</option><option value="1">Último mês</option><option value="2">Último bimestre</option><option value="3">Último trimestre</option><option value="6">Último semestre</option></select>
                    <label><input type="checkbox" id="monitoramento-nao-conforme-filter"> Mostrar somente não conformes</label>
                </div>
                <div id="monitoramento-table-container"><div id="monitoramento-table"></div></div>
            </div>
        `;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = modalHeader + drawerContent;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        const closeModal = () => modalOverlay.remove();
        modalContent.querySelector('.modal-close').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

        const tabs = modalContent.querySelectorAll('.tab-link');
        const tabContents = modalContent.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(c => c.classList.remove('active'));
                modalContent.querySelector(`#${tab.dataset.tab}`).classList.add('active');

                if (tab.dataset.tab === 'tab-2' && !tab.dataset.loaded) {
                    await renderMonitoramentoTab(modalContent, supplier, classificacaoRecords);
                    tab.dataset.loaded = true;
                }
            });
        });
    }

    async function renderMonitoramentoTab(modalContent, supplier, classificacaoRecords) {
        try {
            const supplierClassificacoes = classificacaoRecords.filter(c => c.Fornecedor === supplier.id).sort((a, b) => b.Ano - a.Ano);
            renderClassificacaoTable(modalContent, supplierClassificacoes);
        } catch (error) {
            modalContent.querySelector('#classificacao-table').innerHTML = `<p class="error-msg">Erro ao carregar classificações.</p>`;
        }

        const monitoramentoYearFilter = modalContent.querySelector('#monitoramento-year-filter');
        const years = [...new Set(supplier.deliveries.map(d => d.jsYear))].sort((a, b) => b - a);
        monitoramentoYearFilter.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        
        // Sincroniza o ano selecionado no monitoramento com o filtro do painel principal
        const mainYearFilter = document.getElementById('year-filter');
        const mainSelectedYear = mainYearFilter ? mainYearFilter.value : '';
        if (mainSelectedYear && years.map(String).includes(String(mainSelectedYear))) {
            monitoramentoYearFilter.value = mainSelectedYear;
        } else if (years.length > 0) {
            monitoramentoYearFilter.value = String(years[0]);
        }

        // Filtra os dados iniciais antes de instanciar a tabela para evitar o aviso/erro de inicialização
        const initialFilters = {
            year: monitoramentoYearFilter.value,
            obraFilter: '',
            inspecaoFilter: '',
            dateRange: '',
            naoConformeOnly: false,
            cutoffDate: null
        };
        const initialData = await filterDeliveriesAsync(supplier.deliveries, initialFilters);

        const tableContainer = modalContent.querySelector('#monitoramento-table-container');
        tableContainer.innerHTML = '<div id="monitoramento-table"></div>';

        const table = new Tabulator(modalContent.querySelector('#monitoramento-table'), {
            data: initialData,
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 10,
            paginationSizeSelector: [15, 25, 50, 100],
            placeholder: "Nenhum registro encontrado",
            columns: [
                { title: "Obra", field: "Obra_Local" },
                { title: "Emitente", field: "Emitente_Nome_Fornecedor" },
                { title: "Valor", field: "Valor", formatter: "money", formatterParams: { decimal: ",", thousand: ".", symbol: "R$" } },
                { title: "Inspeção Recebimento", field: "Insp_Recebimento", tooltip: true },
            ],
        });

        const loadData = async () => {
            const filters = {
                year: modalContent.querySelector('#monitoramento-year-filter').value,
                obraFilter: modalContent.querySelector('#monitoramento-obra-filter').value.toLowerCase(),
                inspecaoFilter: modalContent.querySelector('#monitoramento-inspecao-filter').value.toLowerCase(),
                dateRange: modalContent.querySelector('#monitoramento-date-range-filter').value,
                naoConformeOnly: modalContent.querySelector('#monitoramento-nao-conforme-filter').checked,
            };
            let cutoffDate = null;
            if (filters.dateRange) {
                const now = new Date();
                const monthsToSubtract = parseInt(filters.dateRange, 10);
                cutoffDate = new Date(new Date().setMonth(now.getMonth() - monthsToSubtract));
            }
            filters.cutoffDate = cutoffDate;

            const filteredDeliveries = await filterDeliveriesAsync(supplier.deliveries, filters);
            
            if (table.setData) {
                table.setData(filteredDeliveries);
            } else {
                table.on("tableBuilt", () => {
                    table.setData(filteredDeliveries);
                });
            }
        };

        // Add event listeners to filters to reload data
        const debouncedLoadData = debounce(loadData, 300);
        modalContent.querySelector('#monitoramento-year-filter').addEventListener('change', loadData);
        modalContent.querySelector('#monitoramento-obra-filter').addEventListener('input', debouncedLoadData);
        modalContent.querySelector('#monitoramento-inspecao-filter').addEventListener('input', debouncedLoadData);
        modalContent.querySelector('#monitoramento-date-range-filter').addEventListener('change', loadData);
        modalContent.querySelector('#monitoramento-nao-conforme-filter').addEventListener('change', loadData);

        renderNewClassificacaoForm(modalContent, supplier, monitoramentoYearFilter.value, classificacaoRecords);
        monitoramentoYearFilter.addEventListener('change', () => {
            renderNewClassificacaoForm(modalContent, supplier, monitoramentoYearFilter.value, classificacaoRecords);
        });
    }

    function renderClassificacaoTable(modalContent, data) {
        new Tabulator(modalContent.querySelector('#classificacao-table'), {
            data: data,
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 5,
            paginationSizeSelector: [5, 10, 20],
            columns: [
                { title: "Ano", field: "Ano" },
                { title: "Status", field: "Status" },
                { title: "Justificativa", field: "Justificativa" },
                { title: "Data", field: "Data_Classificacao", formatter: "datetime", formatterParams: { outputFormat: "DD/MM/YYYY" } },
            ],
        });
    }

    function filterDeliveriesAsync(deliveries, filters) {
        return new Promise(resolve => {
            const filtered = deliveries.filter(d => {
                if (d.jsYear != filters.year) return false;
                if (filters.obraFilter && !d.Obra_Local.toLowerCase().includes(filters.obraFilter)) return false;
                if (filters.inspecaoFilter && !d.Insp_Recebimento.toLowerCase().includes(filters.inspecaoFilter)) return false;
                if (filters.naoConformeOnly && d.Insp_Recebimento === 'A') return false;
                if (filters.cutoffDate && d.jsDate < filters.cutoffDate) return false;
                return true;
            });
            resolve(filtered);
        });
    }

    function renderNewClassificacaoForm(modalContent, supplier, year, classificacaoRecords) {
        const formContainer = modalContent.querySelector('#new-classificacao-form');
        formContainer.innerHTML = `
            <h5>Nova Classificação para ${year}</h5>
            <textarea id="justificativa-input" placeholder="Justificativa..."></textarea>
            <div class="classification-buttons">
                <button id="aprovar-btn">Aprovar</button>
                <button id="reprovar-btn">Reprovar</button>
            </div>
        `;
        modalContent.querySelector('#aprovar-btn').addEventListener('click', () => {
            handleClassification(supplier.id, year, 'Aprovado', modalContent.querySelector('#justificativa-input').value, classificacaoRecords);
        });
        modalContent.querySelector('#reprovar-btn').addEventListener('click', () => {
            handleClassification(supplier.id, year, 'Reprovado', modalContent.querySelector('#justificativa-input').value, classificacaoRecords);
        });
    }

    async function handleClassification(supplierId, year, status, justificativa, classificacaoRecords) {
        try {
            await dataWriter.addRecord('Classificacao_Fornecedores', {
                Fornecedor: supplierId,
                Ano: parseInt(year, 10),
                Status: status,
                Justificativa: justificativa,
                Data_Classificacao: new Date().getTime() / 1000
            });
            alert(`Fornecedor ${status.toLowerCase()} para ${year}.`);
            const modalContent = document.querySelector('.modal-content');
            if (modalContent) {
                const supplier = suppliers.get(supplierId);
                classificacaoRecords = await lens.fetchTableRecords('Classificacao_Fornecedores');
                await renderMonitoramentoTab(modalContent, supplier, classificacaoRecords);
            }
        } catch (e) {
            console.error('Error adding classification:', e);
            alert('Erro ao adicionar classificação.');
        }
    }

    function populateChartsObraFilter() {
        const chartsObraFilter = document.getElementById('charts-obra-filter');
        if (!chartsObraFilter || chartsObraFilter.options.length > 1) return; // Já populado
        
        const obras = [...new Set(allDeliveries.map(d => d.Obra_Local))].sort();
        obras.forEach(obra => {
            if (obra) {
                const opt = document.createElement('option');
                opt.value = obra;
                opt.textContent = obra;
                chartsObraFilter.appendChild(opt);
            }
        });
    }

    function renderChartsTab() {
        const analysisType = document.getElementById('charts-analysis-type').value;
        const selectedObra = document.getElementById('charts-obra-filter').value;
        const selectedYear = document.getElementById('year-filter').value;
        
        let filteredRecords = allDeliveries;
        
        // 1. Filtragem por ano
        if (selectedYear) {
            filteredRecords = filteredRecords.filter(d => d.jsYear === parseInt(selectedYear));
        }
        
        // 2. Filtragem por obra
        if (selectedObra && selectedObra !== 'all') {
            filteredRecords = filteredRecords.filter(d => d.Obra_Local === selectedObra);
        }

        // 3. Filtragem por material controlado (sincronizado com o painel principal)
        const controladoFilter = document.getElementById('controlado-filter');
        const controladoVal = controladoFilter ? controladoFilter.value : 'controlados';
        if (controladoVal === 'controlados') {
            filteredRecords = filteredRecords.filter(d => {
                const sData = supplierDataMap.get(d.Emitente);
                return sData && sData.controlado;
            });
        } else if (controladoVal === 'nao_controlados') {
            filteredRecords = filteredRecords.filter(d => {
                const sData = supplierDataMap.get(d.Emitente);
                return sData && !sData.controlado;
            });
        }

        populateChartsObraFilter();

        const perfContainer = document.querySelector('.performance-charts');
        const qualContainer = document.querySelector('.quality-charts');
        
        if (analysisType === 'performance') {
            perfContainer.style.display = 'grid';
            qualContainer.style.display = 'none';
            
            const viewOption = document.getElementById('charts-perf-view').value;
            perfContainer.className = 'performance-charts active';
            if (viewOption !== 'both') {
                perfContainer.classList.add('view-single', `view-${viewOption}`);
            }
        } else {
            perfContainer.style.display = 'none';
            qualContainer.style.display = 'grid';
            
            const viewOption = document.getElementById('charts-qual-view').value;
            qualContainer.className = 'quality-charts active';
            qualContainer.classList.add(`view-${viewOption}`);
        }

        // Processa dados de performance
        const perfSummary = filteredRecords.reduce((acc, r) => {
            const name = r.Emitente_Nome_Fornecedor;
            if (!name || name === 'Fornecedor Desconhecido') return acc;
            if (!acc[name]) acc[name] = { count: 0, totalValue: 0 };
            acc[name].count++;
            acc[name].totalValue += parseFloat(r.Valor) || 0;
            return acc;
        }, {});
        
        const perfArray = Object.keys(perfSummary).map(k => ({ name: k, ...perfSummary[k] }));
        const sortedByCount = [...perfArray].sort((a, b) => b.count - a.count).slice(0, 15);
        const sortedByValue = [...perfArray].sort((a, b) => b.totalValue - a.totalValue).slice(0, 15);
        
        drawBarChart('entregasChart', sortedByCount.map(d => d.name), sortedByCount.map(d => d.count), 'Top 15 Fornecedores por Nº de Entregas', 'number');
        drawBarChart('valorChart', sortedByValue.map(d => d.name), sortedByValue.map(d => d.totalValue), 'Top 15 Fornecedores por Valor Total', 'currency');

        // Processa dados de qualidade
        const acceptanceSummary = filteredRecords.reduce((acc, r) => {
            const obra = r.Obra_Local;
            if (!obra) return acc;
            if (!acc[obra]) acc[obra] = { total: 0, accepted: 0 };
            acc[obra].total++;
            if (r.Insp_Recebimento === 'A') acc[obra].accepted++;
            return acc;
        }, {});
        
        const acceptanceArray = Object.keys(acceptanceSummary).map(k => ({
            obra: k,
            percentage: (acceptanceSummary[k].accepted / acceptanceSummary[k].total) * 100 || 0
        })).sort((a,b) => a.percentage - b.percentage).slice(0, 15);
        
        drawBarChart('acceptanceChart', acceptanceArray.map(d => d.obra), acceptanceArray.map(d => d.percentage), '% de Entregas Aceitas ("A") por Obra', 'percent', true);

        const problemRecords = filteredRecords.filter(r => r.Insp_Recebimento !== 'A' && r.Emitente_Nome_Fornecedor && r.Emitente_Nome_Fornecedor !== 'Fornecedor Desconhecido');
        const problemSummary = problemRecords.reduce((acc, r) => {
            const name = r.Emitente_Nome_Fornecedor;
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});
        
        const problemArray = Object.keys(problemSummary).map(k => ({ name: k, count: problemSummary[k] })).sort((a, b) => b.count - a.count).slice(0, 15);
        
        drawBarChart('problemsChart', problemArray.map(d => d.name), problemArray.map(d => d.count), 'Top 15 Fornecedores por Nº de Não Conformidades', 'number');

        // Redimensiona para garantir renderização correta
        setTimeout(() => {
            Object.values(chartInstances).forEach(chart => chart && chart.resize());
        }, 50);
    }

    function drawBarChart(canvasId, labels, data, title, format, horizontal = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const chartConfig = {
            type: 'bar',
            data: { 
                labels, 
                datasets: [{ 
                    label: title, 
                    data, 
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', 
                    borderColor: 'rgba(54, 162, 235, 1)', 
                    borderWidth: 1 
                }] 
            },
            options: {
                indexAxis: horizontal ? 'y' : 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: title, font: { size: 14 } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let value = horizontal ? context.parsed.x : context.parsed.y;
                                if (format === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                                if (format === 'percent') return value.toFixed(1) + '%';
                                return value + (value === 1 ? ' ocorrência' : ' ocorrências');
                            }
                        }
                    }
                },
                scales: {
                    [horizontal ? 'x' : 'y']: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                if (format === 'currency') return value >= 1000 ? `R$ ${value / 1000}k` : `R$ ${value}`;
                                if (format === 'percent') return value + '%';
                                return Number.isInteger(value) ? value : null;
                            }
                        }
                    },
                    [horizontal ? 'y' : 'x']: { ticks: { autoSkip: false } }
                }
            }
        };
        
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].data.labels = labels;
            chartInstances[canvasId].data.datasets[0].data = data;
            chartInstances[canvasId].options.plugins.title.text = title;
            chartInstances[canvasId].update();
        } else {
            chartInstances[canvasId] = new Chart(ctx, chartConfig);
        }
    }

    function initConfigTab() {
        const batchBtn = document.getElementById('batch-link-btn');
        if (batchBtn) {
            batchBtn.addEventListener('click', handleBatchLink);
        }

        const batchMaterial = document.getElementById('batch-material');
        if (batchMaterial) {
            batchMaterial.addEventListener('change', checkBatchButtonState);
        }

        const selectAllBtn = document.getElementById('checklist-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.supplier-check').forEach(cb => cb.checked = true);
                checkBatchButtonState();
            });
        }

        const clearBtn = document.getElementById('checklist-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document.querySelectorAll('.supplier-check').forEach(cb => cb.checked = false);
                checkBatchButtonState();
            });
        }

        const searchInput = document.getElementById('config-supplier-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(populateConfigSuppliersChecklist, 200));
        }

        const indSupplierSelect = document.getElementById('config-individual-supplier');
        if (indSupplierSelect) {
            indSupplierSelect.addEventListener('change', updateIndividualPanel);
        }

        const indClasseSelect = document.getElementById('individual-classe');
        if (indClasseSelect) {
            indClasseSelect.addEventListener('change', handleIndividualClasseChange);
        }

        const indAddMaterialBtn = document.getElementById('individual-add-material-btn');
        if (indAddMaterialBtn) {
            indAddMaterialBtn.addEventListener('click', handleAddMaterialIndividual);
        }
    }

    function populateConfigMaterials() {
        const batchMaterialSelect = document.getElementById('batch-material');
        const indMaterialSelect = document.getElementById('individual-add-material-select');
        
        if (!batchMaterialSelect || !indMaterialSelect) return;
        
        // Preserve values
        const currentBatchVal = batchMaterialSelect.value;
        const currentIndVal = indMaterialSelect.value;
        
        batchMaterialSelect.innerHTML = '<option value="">Selecione um material...</option>';
        indMaterialSelect.innerHTML = '<option value="">Adicionar material...</option>';
        
        materiaisGlobal.sort((a, b) => a.Tipo_Fornecedor.localeCompare(b.Tipo_Fornecedor)).forEach(mat => {
            const label = `${mat.Tipo_Fornecedor} ${mat.Controlado_ ? '⚠️' : '⚪'}`;
            const opt = document.createElement('option');
            opt.value = mat.id;
            opt.textContent = label;
            batchMaterialSelect.appendChild(opt.cloneNode(true));
            indMaterialSelect.appendChild(opt);
        });
        
        batchMaterialSelect.value = currentBatchVal;
        indMaterialSelect.value = currentIndVal;
    }

    function populateConfigSuppliersChecklist() {
        const listContainer = document.getElementById('config-supplier-list');
        if (!listContainer) return;
        
        // Preserve checked states before clearing
        const checkedIds = new Set(Array.from(document.querySelectorAll('.supplier-check:checked')).map(cb => cb.value));
        
        listContainer.innerHTML = '';
        const searchVal = document.getElementById('config-supplier-search').value.toLowerCase();
        
        const filtered = fornecedoresGlobal
            .filter(f => !searchVal || f.Nome_Fornecedor.toLowerCase().includes(searchVal))
            .sort((a, b) => a.Nome_Fornecedor.localeCompare(b.Nome_Fornecedor));
            
        filtered.forEach(supplier => {
            const item = document.createElement('label');
            item.className = 'config-checklist-item';
            
            let isControlled = false;
            if (Array.isArray(supplier.Mat_Controlado)) {
                isControlled = supplier.Mat_Controlado.slice(1).some(val => val === true || val === 1);
            } else {
                isControlled = supplier.Mat_Controlado === true || supplier.Mat_Controlado === 1;
            }
            const badgeHtml = isControlled ? '<span style="color:#009688; font-weight:bold; margin-right:4px;">[C]</span>' : '';
            const checkedAttr = checkedIds.has(String(supplier.id)) ? 'checked' : '';
            
            item.innerHTML = `
                <input type="checkbox" class="supplier-check" value="${supplier.id}" ${checkedAttr}>
                <span>${badgeHtml}${supplier.Nome_Fornecedor}</span>
            `;
            
            item.querySelector('input').addEventListener('change', checkBatchButtonState);
            listContainer.appendChild(item);
        });
        
        checkBatchButtonState();
    }
    
    function checkBatchButtonState() {
        const batchBtn = document.getElementById('batch-link-btn');
        const selectedMaterial = document.getElementById('batch-material').value;
        const checkedCount = document.querySelectorAll('.supplier-check:checked').length;
        
        if (batchBtn) {
            batchBtn.disabled = !selectedMaterial || checkedCount === 0;
            if (!batchBtn.disabled) {
                batchBtn.textContent = `Vincular em Lote (${checkedCount})`;
            } else {
                batchBtn.textContent = 'Vincular Selecionados';
            }
        }
    }

    async function handleBatchLink() {
        const materialId = parseInt(document.getElementById('batch-material').value, 10);
        const classeVal = document.getElementById('batch-classe').value;
        const checkedBoxes = document.querySelectorAll('.supplier-check:checked');
        
        if (!materialId || checkedBoxes.length === 0) return;
        
        const supplierIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));
        
        showNotification('Vinculando fornecedores em lote...', 'info');
        
        try {
            const updatePromises = supplierIds.map(async (supplierId) => {
                const supplier = fornecedoresGlobal.find(f => f.id === supplierId);
                if (!supplier) return;
                
                let currentTipo = supplier.Tipo;
                if (!Array.isArray(currentTipo) || currentTipo[0] !== 'L') {
                    currentTipo = ['L'];
                }
                
                if (!currentTipo.includes(materialId)) {
                    currentTipo.push(materialId);
                }
                
                const changes = { Tipo: currentTipo };
                if (classeVal) {
                    changes.Classe = classeVal;
                }
                
                await lens.updateRecord('Fornecedores', supplierId, changes);
            });
            
            await Promise.all(updatePromises);
            showNotification('Vínculo em lote realizado com sucesso!', 'success');
            
            // Limpa as caixas de seleção da checklist
            document.querySelectorAll('.supplier-check').forEach(cb => cb.checked = false);
            
            await refreshData();
            
        } catch (error) {
            console.error('Erro no vínculo em lote:', error);
            showNotification('Erro ao vincular fornecedores.', 'error');
        }
    }

    function populateConfigIndividualSupplierSelect() {
        const select = document.getElementById('config-individual-supplier');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione um fornecedor...</option>';
        
        fornecedoresGlobal.sort((a, b) => a.Nome_Fornecedor.localeCompare(b.Nome_Fornecedor)).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.Nome_Fornecedor;
            select.appendChild(opt);
        });
        
        select.value = currentVal;
    }

    async function updateIndividualPanel() {
        const supplierIdVal = document.getElementById('config-individual-supplier').value;
        const panel = document.getElementById('individual-config-panel');
        
        if (!supplierIdVal) {
            panel.style.display = 'none';
            return;
        }
        
        panel.style.display = 'block';
        const supplierId = parseInt(supplierIdVal, 10);
        const supplier = fornecedoresGlobal.find(f => f.id === supplierId);
        
        if (!supplier) return;
        
        // 1. Classe
        const classeSelect = document.getElementById('individual-classe');
        classeSelect.value = supplier.Classe || '';
        
        // 2. Materiais
        const tagsContainer = document.getElementById('individual-materials-list');
        tagsContainer.innerHTML = '';
        
        let linkedIds = [];
        if (Array.isArray(supplier.Tipo) && supplier.Tipo[0] === 'L') {
            linkedIds = supplier.Tipo.slice(1);
        }
        
        if (linkedIds.length === 0) {
            tagsContainer.innerHTML = '<span class="config-help">Nenhum material vinculado.</span>';
        } else {
            linkedIds.forEach(id => {
                const mat = materiaisGlobal.find(m => m.id === id);
                if (mat) {
                    const tag = document.createElement('div');
                    tag.className = 'tag-item' + (mat.Controlado_ ? ' controlled' : '');
                    tag.innerHTML = `
                        <span>${mat.Tipo_Fornecedor} ${mat.Controlado_ ? '⚠️' : ''}</span>
                        <button class="tag-delete-btn" data-material-id="${mat.id}">&times;</button>
                    `;
                    
                    tag.querySelector('.tag-delete-btn').addEventListener('click', () => handleRemoveMaterial(supplierId, mat.id));
                    tagsContainer.appendChild(tag);
                }
            });
        }
    }

    async function handleIndividualClasseChange() {
        const supplierIdVal = document.getElementById('config-individual-supplier').value;
        if (!supplierIdVal) return;
        const supplierId = parseInt(supplierIdVal, 10);
        const classeVal = document.getElementById('individual-classe').value;
        
        try {
            await lens.updateRecord('Fornecedores', supplierId, { Classe: classeVal || null });
            showNotification('Classe atualizada com sucesso!', 'success');
            await refreshData();
        } catch (error) {
            console.error('Erro ao atualizar classe:', error);
            showNotification('Erro ao atualizar classe.', 'error');
        }
    }

    async function handleAddMaterialIndividual() {
        const supplierIdVal = document.getElementById('config-individual-supplier').value;
        const materialIdVal = document.getElementById('individual-add-material-select').value;
        
        if (!supplierIdVal || !materialIdVal) return;
        
        const supplierId = parseInt(supplierIdVal, 10);
        const materialId = parseInt(materialIdVal, 10);
        
        const supplier = fornecedoresGlobal.find(f => f.id === supplierId);
        if (!supplier) return;
        
        let currentTipo = supplier.Tipo;
        if (!Array.isArray(currentTipo) || currentTipo[0] !== 'L') {
            currentTipo = ['L'];
        }
        
        if (currentTipo.includes(materialId)) {
            showNotification('Material já vinculado a este fornecedor.', 'info');
            return;
        }
        
        currentTipo.push(materialId);
        
        try {
            await lens.updateRecord('Fornecedores', supplierId, { Tipo: currentTipo });
            showNotification('Material adicionado com sucesso!', 'success');
            document.getElementById('individual-add-material-select').value = '';
            await refreshData();
        } catch (error) {
            console.error('Erro ao adicionar material:', error);
            showNotification('Erro ao adicionar material.', 'error');
        }
    }

    async function handleRemoveMaterial(supplierId, materialId) {
        const supplier = fornecedoresGlobal.find(f => f.id === supplierId);
        if (!supplier) return;
        
        let currentTipo = supplier.Tipo;
        if (!Array.isArray(currentTipo) || currentTipo[0] !== 'L') return;
        
        const updatedTipo = currentTipo.filter(id => id !== materialId);
        
        try {
            await lens.updateRecord('Fornecedores', supplierId, { Tipo: updatedTipo });
            showNotification('Material removido com sucesso!', 'success');
            await refreshData();
        } catch (error) {
            console.error('Erro ao remover material:', error);
            showNotification('Erro ao remover material.', 'error');
        }
    }

    async function refreshData() {
        try {
            const [fornecedores, classificacoes] = await Promise.all([
                lens.fetchTableRecords('Fornecedores'),
                lens.fetchTableRecords('Classificacao_Fornecedores')
            ]);
            fornecedoresGlobal = fornecedores;
            classificacaoRecords = classificacoes;
            
            // Atualiza o map de controle
            supplierDataMap = new Map(fornecedores.map(f => {
                let isControlled = false;
                if (Array.isArray(f.Mat_Controlado)) {
                    isControlled = f.Mat_Controlado.slice(1).some(val => val === true || val === 1);
                } else {
                    isControlled = f.Mat_Controlado === true || f.Mat_Controlado === 1;
                }
                return [f.id, {
                    nome: f.Nome_Fornecedor || 'Fornecedor Desconhecido',
                    controlado: isControlled
                }];
            }));
            
            processDeliveries();
            await renderDashboard(classificacaoRecords);
            
            // Repopula e atualiza a aba de config
            populateConfigSuppliersChecklist();
            populateConfigIndividualSupplierSelect();
            updateIndividualPanel();
        } catch (e) {
            console.error('Error refreshing data:', e);
        }
    }

    function showNotification(message, type = 'success') {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
        
        return toast;
    }

    initialize();
});