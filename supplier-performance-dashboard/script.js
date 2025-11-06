import { GristTableLens } from '../../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../../libraries/grist-data-writer.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Content Loaded. Starting widget initialization.");

    let allDeliveries = [];
    let suppliers = new Map();
    let lens;
    let dataWriter;

    try {
        await grist.ready();
        console.log("Grist is ready.");
        lens = new GristTableLens(grist);
        dataWriter = new GristDataWriter(grist);
        console.log("GristTableLens and GristDataWriter instantiated.");
    } catch (e) {
        console.error("Error during Grist initialization:", e);
        return; // Stop if Grist setup fails
    }

    async function initialize() {
        console.log("Initialize function started.");
        const filterBarContainer = document.getElementById('filter-bar');
        if (filterBarContainer) {
            try {
                console.log("Fetching filter-bar.html...");
                const response = await fetch('filter-bar.html');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                filterBarContainer.innerHTML = html;
                console.log("Filter bar HTML loaded successfully.");
            } catch (error) {
                console.error('Error loading filter bar:', error);
            }
        } else {
            console.error("Filter bar container not found!");
        }

        try {
            console.log("Fetching 'Dados' table...");
            allDeliveries = await lens.fetchTableRecords('Dados');
            console.log(`Fetched ${allDeliveries.length} records from 'Dados'.`);

            console.log("Fetching 'Fornecedores' table...");
            const allFornecedores = await lens.fetchTableRecords('Fornecedores');
            console.log(`Fetched ${allFornecedores.length} records from 'Fornecedores'.`);

            const supplierNames = new Map(allFornecedores.map(f => [f.id, f.Nome_Fornecedor]));

            allDeliveries.forEach(d => {
                d.Emitente_Nome_Fornecedor = supplierNames.get(d.Emitente) || 'Fornecedor Desconhecido';
            });
            console.log("Supplier names mapped to deliveries.");

        } catch (error) {
            console.error("Error fetching initial data:", error);
            // Render a message to the user in the dashboard container
            const container = document.getElementById('dashboard-container');
            if(container) container.innerHTML = `<p class="error-msg">Erro ao carregar dados. Verifique se as tabelas 'Dados' e 'Fornecedores' existem e se o widget tem permissão para acessá-las.</p>`;
            return; // Stop execution if data fetching fails
        }

        console.log("Processing deliveries...");
        processDeliveries();
        console.log("Populating filters...");
        populateFilters();
        console.log("Rendering dashboard...");
        renderDashboard();
        console.log("Setting up filter listeners...");
        setupFilterListeners();
        console.log("Initialization complete.");
    }

    function setupFilterListeners() {
        document.getElementById('search-input').addEventListener('input', renderDashboard);
        document.getElementById('obra-filter-input').addEventListener('input', renderDashboard);
        document.getElementById('year-filter').addEventListener('change', renderDashboard);
        document.getElementById('sort-order').addEventListener('change', renderDashboard);
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
        const years = [...new Set(allDeliveries.map(d => new Date(d.Emissao * 1000).getFullYear()))].sort((a, b) => b - a);

        obraDatalist.innerHTML = obras.map(o => `<option value="${o}"></option>`).join('');
        yearFilter.innerHTML = '<option value="">Todos os Anos</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');

        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
            yearFilter.value = currentYear;
        }
    }

    function renderDashboard() {
        const container = document.getElementById('dashboard-container');
        container.innerHTML = '';

        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const selectedObra = document.getElementById('obra-filter-input').value;
        const selectedYear = document.getElementById('year-filter').value;
        const sortOrder = document.getElementById('sort-order').value;

        let supplierMetrics = Array.from(suppliers.values()).map(supplier => {
            const filteredDeliveries = supplier.deliveries.filter(d => {
                const deliveryYear = new Date(d.Emissao * 1000).getFullYear();
                const obraMatch = !selectedObra || d.Obra_Local === selectedObra;
                const yearMatch = !selectedYear || deliveryYear === parseInt(selectedYear);
                return obraMatch && yearMatch;
            });

            if (filteredDeliveries.length === 0) {
                return null;
            }

            const totalDeliveries = filteredDeliveries.length;
            const nonConformingDeliveries = filteredDeliveries.filter(d => d.Insp_Recebimento !== 'A');
            const totalValue = filteredDeliveries.reduce((sum, d) => sum + d.Valor, 0);
            const nonConformingValue = nonConformingDeliveries.reduce((sum, d) => sum + d.Valor, 0);

            return {
                ...supplier,
                metrics: {
                    totalDeliveries,
                    nonConformingCount: nonConformingDeliveries.length,
                    nonConformingPercentage: totalDeliveries > 0 ? (nonConformingDeliveries.length / totalDeliveries) * 100 : 0,
                    totalValue,
                    nonConformingValue,
                    nonConformingValuePercentage: totalValue > 0 ? (nonConformingValue / totalValue) * 100 : 0
                }
            };
        }).filter(Boolean);

        if (searchTerm) {
            supplierMetrics = supplierMetrics.filter(s => s.name.toLowerCase().includes(searchTerm));
        }

        if (sortOrder === 'most_deliveries') {
            supplierMetrics.sort((a, b) => b.metrics.totalDeliveries - a.metrics.totalDeliveries);
        } else if (sortOrder === 'highest_value') {
            supplierMetrics.sort((a, b) => b.metrics.totalValue - a.metrics.totalValue);
        }

        supplierMetrics.forEach(supplier => {
            const card = document.createElement('div');
            card.className = 'supplier-card';
            card.innerHTML = `
                <h3>${supplier.name}</h3>
                <p>Total de Entregas: ${supplier.metrics.totalDeliveries}</p>
                <p>Entregas Não Conformes: ${supplier.metrics.nonConformingCount} (${supplier.metrics.nonConformingPercentage.toFixed(2)}%)</p>
                <p>Valor Total: ${supplier.metrics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <p>Valor Não Conforme: ${supplier.metrics.nonConformingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${supplier.metrics.nonConformingValuePercentage.toFixed(2)}%)</p>
            `;
            card.addEventListener('click', () => {
                openCustomDrawer(supplier);
            });
            container.appendChild(card);
        });
    }

    async function openCustomDrawer(supplier) {
        const drawerContent = `
            <div class="tabs">
                <button class="tab-link active" data-tab="tab-1">Seleção Inicial</button>
                <button class="tab-link" data-tab="tab-2">Monitoramento</button>
            </div>
            <div id="tab-1" class="tab-content active">
                <p>Placeholder for Seleção Inicial content.</p>
            </div>
            <div id="tab-2" class="tab-content">
                <div id="classificacao-container">
                    <h4>Classificações Anteriores</h4>
                    <div id="classificacao-table"></div>
                    <div id="new-classificacao-form"></div>
                </div>
                <hr>
                <h4>Entregas</h4>
                <div class="monitoramento-filters">
                    <select id="monitoramento-year-filter"></select>
                    <input type="text" id="monitoramento-obra-filter" placeholder="Filtrar Obra...">
                    <input type="text" id="monitoramento-inspecao-filter" placeholder="Filtrar Inspeção...">
                    <select id="monitoramento-date-range-filter">
                        <option value="">Todo o período</option>
                        <option value="1">Último mês</option>
                        <option value="2">Último bimestre</option>
                        <option value="3">Último trimestre</option>
                        <option value="6">Último semestre</option>
                    </select>
                    <label><input type="checkbox" id="monitoramento-nao-conforme-filter"> Mostrar somente não conformes</label>
                </div>
                <div id="monitoramento-table"></div>
            </div>
        `;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.innerHTML = `<span class="modal-close">&times;</span>` + drawerContent;

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        const closeModal = () => modalOverlay.remove();
        modalContent.querySelector('.modal-close').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });

        const tabs = modalContent.querySelectorAll('.tab-link');
        const tabContents = modalContent.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(c => c.classList.remove('active'));
                modalContent.querySelector(`#${tab.dataset.tab}`).classList.add('active');
            });
        });

        await renderMonitoramentoTab(modalContent, supplier);
    }

    async function renderMonitoramentoTab(modalContent, supplier) {
        try {
            console.log("Fetching 'Classificacao_Fornecedores' table...");
            const classificacaoRecords = await lens.fetchTableRecords('Classificacao_Fornecedores');
            console.log(`Fetched ${classificacaoRecords.length} records from 'Classificacao_Fornecedores'.`);
            const supplierClassificacoes = classificacaoRecords.filter(c => c.Fornecedor === supplier.id).sort((a, b) => b.Ano - a.Ano);
            renderClassificacaoTable(modalContent, supplierClassificacoes);
        } catch (error) {
            console.error("Error fetching classification data:", error);
            modalContent.querySelector('#classificacao-table').innerHTML = `<p class="error-msg">Erro ao carregar classificações. Verifique se a tabela 'Classificacao_Fornecedores' existe.</p>`;
        }

        const monitoramentoYearFilter = modalContent.querySelector('#monitoramento-year-filter');
        const years = [...new Set(supplier.deliveries.map(d => new Date(d.Emissao * 1000).getFullYear()))].sort((a, b) => b - a);
        monitoramentoYearFilter.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');

        const renderTable = () => renderMonitoramentoTable(modalContent, supplier);

        modalContent.querySelector('#monitoramento-year-filter').addEventListener('change', renderTable);
        modalContent.querySelector('#monitoramento-obra-filter').addEventListener('input', renderTable);
        modalContent.querySelector('#monitoramento-inspecao-filter').addEventListener('input', renderTable);
        modalContent.querySelector('#monitoramento-date-range-filter').addEventListener('change', renderTable);
        modalContent.querySelector('#monitoramento-nao-conforme-filter').addEventListener('change', renderTable);

        renderMonitoramentoTable(modalContent, supplier);
        renderNewClassificacaoForm(modalContent, supplier, monitoramentoYearFilter.value);

        monitoramentoYearFilter.addEventListener('change', () => {
            renderNewClassificacaoForm(modalContent, supplier, monitoramentoYearFilter.value);
        });
    }

    function renderClassificacaoTable(modalContent, data) {
        new Tabulator(modalContent.querySelector('#classificacao-table'), {
            data: data,
            layout: "fitColumns",
            columns: [
                { title: "Ano", field: "Ano" },
                { title: "Status", field: "Status" },
                { title: "Justificativa", field: "Justificativa" },
                { title: "Data", field: "Data_Classificacao", formatter: "datetime", formatterParams: { outputFormat: "DD/MM/YYYY" } },
            ],
        });
    }

    function renderMonitoramentoTable(modalContent, supplier) {
        const year = modalContent.querySelector('#monitoramento-year-filter').value;
        const obraFilter = modalContent.querySelector('#monitoramento-obra-filter').value.toLowerCase();
        const inspecaoFilter = modalContent.querySelector('#monitoramento-inspecao-filter').value.toLowerCase();
        const dateRange = modalContent.querySelector('#monitoramento-date-range-filter').value;
        const naoConformeOnly = modalContent.querySelector('#monitoramento-nao-conforme-filter').checked;

        let filteredDeliveries = supplier.deliveries.filter(d => new Date(d.Emissao * 1000).getFullYear() == year);

        if (obraFilter) {
            filteredDeliveries = filteredDeliveries.filter(d => d.Obra_Local.toLowerCase().includes(obraFilter));
        }
        if (inspecaoFilter) {
            filteredDeliveries = filteredDeliveries.filter(d => d.Insp_Recebimento.toLowerCase().includes(inspecaoFilter));
        }
        if (naoConformeOnly) {
            filteredDeliveries = filteredDeliveries.filter(d => d.Insp_Recebimento !== 'A');
        }
        if (dateRange) {
            const now = new Date();
            const monthsToSubtract = parseInt(dateRange, 10);
            const cutoffDate = new Date(new Date().setMonth(now.getMonth() - monthsToSubtract));
            filteredDeliveries = filteredDeliveries.filter(d => new Date(d.Emissao * 1000) >= cutoffDate);
        }

        new Tabulator(modalContent.querySelector('#monitoramento-table'), {
            data: filteredDeliveries,
            layout: "fitColumns",
            columns: [
                { title: "Obra", field: "Obra_Local" },
                { title: "Emitente", field: "Emitente_Nome_Fornecedor" },
                { title: "Valor", field: "Valor", formatter: "money", formatterParams: { decimal: ",", thousand: ".", symbol: "R$" } },
                { title: "Inspeção Recebimento", field: "Insp_Recebimento" },
            ],
        });
    }

    function renderNewClassificacaoForm(modalContent, supplier, year) {
        const formContainer = modalContent.querySelector('#new-classificacao-form');
        formContainer.innerHTML = `
            <h5>Nova Classificação para ${year}</h5>
            <textarea id="justificativa-input" placeholder="Justificativa..."></textarea>
            <button id="aprovar-btn">Aprovar</button>
            <button id="reprovar-btn">Reprovar</button>
        `;

        modalContent.querySelector('#aprovar-btn').addEventListener('click', () => {
            handleClassification(supplier.id, year, 'Aprovado', modalContent.querySelector('#justificativa-input').value);
        });
        modalContent.querySelector('#reprovar-btn').addEventListener('click', () => {
            handleClassification(supplier.id, year, 'Reprovado', modalContent.querySelector('#justificativa-input').value);
        });
    }

    async function handleClassification(supplierId, year, status, justificativa) {
        console.log(`Attempting to classify supplier ${supplierId} for year ${year} as ${status}`);
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
                await renderMonitoramentoTab(modalContent, supplier);
            }
        } catch (e) {
            console.error('Error adding classification:', e);
            alert('Erro ao adicionar classificação. Verifique se a tabela e as colunas estão corretas.');
        }
    }

    initialize();
});