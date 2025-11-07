import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../../libraries/grist-data-writer.js';

document.addEventListener('DOMContentLoaded', async () => {
    let allDeliveries = [];
    let suppliers = new Map();
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
            const [deliveries, fornecedores, classificacoes] = await Promise.all([
                lens.fetchTableRecords('Dados'),
                lens.fetchTableRecords('Fornecedores'),
                lens.fetchTableRecords('Classificacao_Fornecedores')
            ]);
            allDeliveries = deliveries;
            classificacaoRecords = classificacoes;

            const supplierNames = new Map(fornecedores.map(f => [f.id, f.Nome_Fornecedor]));

            allDeliveries.forEach(d => {
                d.Emitente_Nome_Fornecedor = supplierNames.get(d.Emitente) || 'Fornecedor Desconhecido';
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
    }
    
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function setupFilterListeners(classificacaoRecords) {
        const debouncedRender = debounce(() => renderDashboard(classificacaoRecords), 300);
        document.getElementById('search-input').addEventListener('input', debouncedRender);
        document.getElementById('obra-filter-input').addEventListener('input', debouncedRender);
        document.getElementById('obra-only-filter').addEventListener('change', () => renderDashboard(classificacaoRecords));
        document.getElementById('year-filter').addEventListener('change', () => renderDashboard(classificacaoRecords));
        document.getElementById('sort-order').addEventListener('change', () => renderDashboard(classificacaoRecords));
    }

    function processDeliveries() {
        suppliers.clear();
        allDeliveries.forEach(delivery => {
            const supplierId = delivery.Emitente;
            if (!suppliers.has(supplierId)) {
                suppliers.set(supplierId, {
                    id: supplierId,
                    name: delivery.Emitente_Nome_Fornecedor,
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

        card.innerHTML = `
            <div class="card-header">
                <h3 class="supplier-name">${supplier.name}</h3>
                <div class="card-status">${seal} ${outdatedIcon}</div>
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

        const tableContainer = modalContent.querySelector('#monitoramento-table-container');
        tableContainer.innerHTML = '<div id="monitoramento-table"></div>';

        const table = new Tabulator(modalContent.querySelector('#monitoramento-table'), {
            data: [],
            layout: "fitColumns",
            pagination: "local",
            paginationSize: 10,
            paginationSizeSelector: [15, 25, 50, 100],
            placeholder: "Carregando...",
            columns: [
                { title: "Obra", field: "Obra_Local" },
                { title: "Emitente", field: "Emitente_Nome_Fornecedor" },
                { title: "Valor", field: "Valor", formatter: "money", formatterParams: { decimal: ",", thousand: ".", symbol: "R$" } },
                { title: "Inspeção Recebimento", field: "Insp_Recebimento", tooltip: true },
            ],
        });

        const loadData = async () => {
            table.setData([]); // Clear table and show placeholder
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
            table.setData(filteredDeliveries);
        };

        // Load data immediately
        loadData();

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

    initialize();
});