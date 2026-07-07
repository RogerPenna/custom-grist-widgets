import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.0.4';

let currentRecords = [];
let STAGES = [];

// Helper function to invoke TableLens/DataWriter methods inside the nested iframe via postMessage RPC
function callIframe(method, args) {
    return new Promise((resolve, reject) => {
        const transactionId = Math.random().toString(36).substr(2, 9);
        const handleResponse = (e) => {
            if (e.data && e.data.action === 'table-lens-response' && e.data.transactionId === transactionId) {
                window.removeEventListener('message', handleResponse);
                if (e.data.error) reject(new Error(e.data.error));
                else resolve(e.data.result);
            }
        };
        window.addEventListener('message', handleResponse);
        
        const viewerIframe = document.querySelector('#pane-inventario iframe');
        if (viewerIframe && viewerIframe.contentWindow) {
            viewerIframe.contentWindow.postMessage({
                action: 'table-lens-request',
                method,
                args,
                transactionId
            }, '*');
        } else {
            window.removeEventListener('message', handleResponse);
            reject(new Error("Iframe de inventário não carregado."));
        }
    });
}

// Javascript Proxy mocks that automatically forward any method calls to the nested iframe
const mockTableLens = new Proxy({}, {
    get: (target, prop) => {
        return async (...args) => callIframe(prop, args);
    }
});

const mockDataWriter = new Proxy({}, {
    get: (target, prop) => {
        return async (...args) => callIframe(prop, args);
    }
});

const messageSources = new Map();

// Proxy messages to nested iframes and listen to data updates
window.addEventListener('message', (event) => {
    if (!event.data) return;

    // Listen to data loaded from the Grist table inside the iframe
    if (event.data.action === 'instruments-data-loaded') {
        currentRecords = event.data.records || [];
        const rawChoices = event.data.choices || [];
        STAGES = rawChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso");
        
        // If the Kanban tab is active, re-render it
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTab === 'fluxo') {
            renderKanban();
        }
        return;
    }

    // Ignore internal actions
    if (event.data.action === 'open-instrument-drawer' || 
        event.data.action === 'update-instrument-stage' || 
        event.data.action === 'table-lens-request' ||
        event.data.action === 'table-lens-response') return;

    // Relay Grist Plugin messages correctly using request tracking to prevent double handshake conflict
    if (event.source === window.parent) {
        // This is a reply from Grist
        const rc = event.data.rc;
        const targetIframe = messageSources.get(rc);
        if (targetIframe && targetIframe.contentWindow) {
            targetIframe.contentWindow.postMessage(event.data, '*');
        } else {
            // Fallback: send to all iframes if rc is not found
            document.querySelectorAll('iframe').forEach(iframe => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage(event.data, '*');
                }
            });
        }
    } else {
        // This is a request from a nested iframe to Grist
        const rc = event.data.rc;
        if (rc !== undefined) {
            const iframe = Array.from(document.querySelectorAll('iframe'))
                .find(f => f.contentWindow === event.source);
            if (iframe) {
                messageSources.set(rc, iframe);
            }
        }
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

function renderKanban() {
    const board = document.getElementById('kanban-board-container');
    if (STAGES.length === 0) {
        board.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-style:italic;">Aguardando sincronização da tabela... Certifique-se de que a aba "Inventário Geral" foi carregada.</div>';
        return;
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
                    }
                }
            }
        });
    });
}
