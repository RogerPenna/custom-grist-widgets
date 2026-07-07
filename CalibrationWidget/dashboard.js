import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.4';

const BASE_URL = 'http://192.168.0.95:8484/api';
const API_KEY = '24b20630caea9fc5bfa4aa76a803314f57d045c7';
const DOC_ID = 'iJ2oJCJTYehz4C6XuAFGpk';

let currentRecords = [];
let STAGES = [];

// REST-based mock TableLens and DataWriter to allow GristDrawer to run outside Grist handshake context
const mockTableLens = {
    getTableSchema: async (tableId) => {
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/${tableId}/columns?api_key=${API_KEY}`);
        const data = await r.json();
        const schema = {};
        data.columns.forEach(col => {
            schema[col.id] = {
                colId: col.id,
                type: col.fields.type,
                label: col.fields.label,
                widgetOptions: col.fields.widgetOptions
            };
        });
        return schema;
    },
    fetchRecordById: async (tableId, recordId) => {
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/${tableId}/records?api_key=${API_KEY}`);
        const data = await r.json();
        const rec = data.records.find(row => row.id === recordId);
        return rec ? { id: rec.id, ...rec.fields } : null;
    },
    fetchConfig: async (configId) => {
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/Grf_config/records?api_key=${API_KEY}`);
        const data = await r.json();
        const rec = data.records.find(row => row.fields.configId === configId);
        if (!rec) return null;
        
        let mergedConfig = {};
        try {
            if (rec.fields.configJson) mergedConfig = JSON.parse(rec.fields.configJson);
        } catch(e) {}
        try {
            if (rec.fields.mappingJson) mergedConfig.mapping = JSON.parse(rec.fields.mappingJson);
        } catch(e) {}
        try {
            if (rec.fields.stylingJson) mergedConfig.styling = JSON.parse(rec.fields.stylingJson);
        } catch(e) {}
        try {
            if (rec.fields.actionsJson) mergedConfig.actions = JSON.parse(rec.fields.actionsJson);
        } catch(e) {}
        return mergedConfig;
    }
};

const mockDataWriter = {
    updateRecord: async (tableId, recordId, changes) => {
        await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/${tableId}/records?api_key=${API_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                records: [{ id: recordId, fields: changes }]
            })
        });
        // Notify iframe table of data updates
        const viewerIframe = document.querySelector('#pane-inventario iframe');
        if (viewerIframe && viewerIframe.contentWindow) {
            viewerIframe.contentWindow.postMessage({ action: 'reload-records' }, '*');
        }
        // Refresh Kanban locally
        renderKanban();
    },
    addRecord: async (tableId, changes) => {
        await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/${tableId}/records?api_key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                records: [{ fields: changes }]
            })
        });
        const viewerIframe = document.querySelector('#pane-inventario iframe');
        if (viewerIframe && viewerIframe.contentWindow) {
            viewerIframe.contentWindow.postMessage({ action: 'reload-records' }, '*');
        }
        renderKanban();
    },
    deleteRecords: async (tableId, recordIds) => {
        // Mock delete if needed
    }
};

// Proxy messages to nested iframes and listen to data updates
window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.action === 'instruments-data-loaded') {
        currentRecords = event.data.records || [];
        const rawChoices = event.data.choices || [];
        STAGES = rawChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso");
        
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTab === 'fluxo') {
            renderKanban();
        }
        return;
    }

    if (event.data.action === 'open-instrument-drawer' || event.data.action === 'update-instrument-stage') return;

    if (event.source === window.parent) {
        document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage(event.data, '*');
            }
        });
    } else {
        window.parent.postMessage(event.data, '*');
    }
});

// Tab switcher logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = `pane-${btn.dataset.tab}`;
        document.getElementById(targetId).classList.add('active');

        if (btn.dataset.tab === 'fluxo') {
            renderKanban();
        }
    });
});

async function renderKanban() {
    const board = document.getElementById('kanban-board-container');
    if (STAGES.length === 0) {
        board.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-style:italic;">Aguardando sincronização da tabela... Certifique-se de que a aba "Inventário Geral" foi carregada.</div>';
        return;
    }

    // Refresh records dynamically using REST API to make sure dragging and editing has immediate effect
    try {
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/INSTRUMENTS/records?api_key=${API_KEY}`);
        const data = await r.json();
        currentRecords = data.records.map(rec => ({ id: rec.id, ...rec.fields }));
    } catch (err) {
        console.error("Erro ao recarregar registros REST para o Kanban:", err);
    }

    board.innerHTML = '';

    // Create column elements
    const colContainers = {};
    STAGES.forEach(stageName => {
        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.innerHTML = `
            <div class="kanban-column-header">
                <span>${stageName}</span>
                <span class="column-count" id="count-${stageName.replace(/[^a-zA-Z0-9]/g, '')}">0</span>
            </div>
            <div class="kanban-cards-container" data-stage="${stageName}"></div>
        `;
        board.appendChild(col);
        colContainers[stageName] = col.querySelector('.kanban-cards-container');
    });

    // Populate columns with instrument cards
    let counts = {};
    STAGES.forEach(s => counts[s] = 0);

    currentRecords.forEach(inst => {
        let stage = inst.METROLOGICAL_STAGE || "0. Em Uso";
        if (stage === "0. Em Uso" || !STAGES.includes(stage)) {
            return;
        }

        counts[stage]++;

        const card = document.createElement('div');
        card.className = 'instrument-card';
        card.dataset.id = inst.id;

        const code = inst.Code || inst.CODE || `Instrumento #${inst.id}`;
        const type = inst.z_disp_ID_INSTRUMENT_TYPE || inst.ID_INSTRUMENT_TYPE || 'Sem Tipo';
        const model = inst.z_disp_ID_INSTRUMENT_MODEL || inst.ID_INSTRUMENT_MODEL || 'Sem Modelo';
        const resp = inst.z_disp_ID_RESPONSIBLE || inst.ID_RESPONSIBLE || 'Não Atribuído';
        const status = inst.z_disp_ID_STATUS || inst.ID_STATUS || 'Disponível';
        
        let statusClass = 'disponivel';
        const statusStr = String(status).toLowerCase();
        if (statusStr.includes('laborat') || statusStr.includes('externo')) {
            statusClass = 'laboratorio';
        } else if (statusStr.includes('emprest')) {
            statusClass = 'laboratorio';
        }

        card.innerHTML = `
            <div class="card-tag">${code}</div>
            <div class="card-details">
                <strong>${type}</strong> - ${model}
            </div>
            <div class="card-details" style="color: #64748b; font-size: 11px;">
                👤 Resp: ${resp}
            </div>
            <div class="card-meta">
                <span class="card-badge-status ${statusClass}">${status}</span>
                <span class="card-badge">${inst.NEXT_CALIBRATION ? String(inst.NEXT_CALIBRATION).split('T')[0] : 'S/ Data'}</span>
            </div>
        `;

        // Card click selection - Opens Details Drawer directly on the parent window!
        card.addEventListener('click', async () => {
            document.querySelectorAll('.instrument-card').forEach(c => c.style.borderColor = '#e2e8f0');
            card.style.borderColor = 'var(--primary)';

            try {
                const drawerId = "drawerinstruments";
                const drawerCfg = await mockTableLens.fetchConfig(drawerId);
                await openDrawer('INSTRUMENTS', inst.id, { 
                    ...drawerCfg, 
                    tableLens: mockTableLens,
                    dataWriter: mockDataWriter,
                    mode: 'view'
                });
            } catch (err) {
                console.error("[Dashboard] Erro ao abrir gaveta de detalhes:", err);
            }
        });

        if (colContainers[stage]) {
            colContainers[stage].appendChild(card);
        }
    });

    // Update column counters
    STAGES.forEach(stageName => {
        const cleanName = stageName.replace(/[^a-zA-Z0-9]/g, '');
        const badge = document.getElementById(`count-${cleanName}`);
        if (badge) badge.textContent = counts[stageName];
    });

    // Initialize Sortable on each cards container
    STAGES.forEach(stageName => {
        const container = colContainers[stageName];
        new Sortable(container, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: async (evt) => {
                const itemEl = evt.item;
                const targetStage = evt.to.dataset.stage;
                const recordId = parseInt(itemEl.dataset.id, 10);
                
                if (recordId && targetStage) {
                    console.log(`Mover registro ${recordId} para ${targetStage}`);
                    
                    const updates = { METROLOGICAL_STAGE: targetStage };
                    
                    if (targetStage.includes("5. Enviado")) {
                        updates.ID_STATUS = 3;
                    } else if (targetStage.includes("1. Planejado")) {
                        updates.ID_STATUS = 1;
                    }

                    const occurrenceData = {
                        ID_INSTRUMENT: recordId,
                        DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                        REAL_DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                        COMMENTS: `Estágio logístico alterado no Kanban para: ${targetStage}`,
                        ID_SITUATION: 1 // Ativo
                    };

                    try {
                        await mockDataWriter.updateRecord('INSTRUMENTS', recordId, updates);
                        await mockDataWriter.addRecord('INSTRUMENTS_OCCURRENCES', occurrenceData);
                    } catch(err) {
                        console.error("Erro ao mover cartão:", err);
                        renderKanban();
                    }
                }
            }
        });
    });
}
