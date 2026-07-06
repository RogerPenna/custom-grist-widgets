const BASE_URL = 'http://192.168.0.95:8484/api';
const API_KEY = '24b20630caea9fc5bfa4aa76a803314f57d045c7';
const DOC_ID = 'iJ2oJCJTYehz4C6XuAFGpk';

let currentRecords = [];
let STAGES = [];

async function loadStages() {
    try {
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/INSTRUMENTS/columns`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await r.json();
        const col = data.columns.find(c => c.id === 'METROLOGICAL_STAGE');
        if (col && col.fields.widgetOptions) {
            const opt = (typeof col.fields.widgetOptions === 'string') 
                ? JSON.parse(col.fields.widgetOptions) 
                : col.fields.widgetOptions;
            const rawChoices = opt.choices || [];
            STAGES = rawChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso");
        }
    } catch (e) {
        console.error("Erro ao carregar estágios dinâmicos do Grist:", e);
    }
    
    // Fallback if empty
    if (STAGES.length === 0) {
        STAGES = [
            "1. Planejado",
            "2. Orçamento",
            "3. Notificar Responsável",
            "4. Recebido na Matriz",
            "5. Enviado ao Laboratório",
            "6. Retornado (Importar Laudo)"
        ];
    }
}

// Proxy Grist messages to and from nested iframes to resolve handshake on nested structures
window.addEventListener('message', (event) => {
    if (!event.data) return;
    
    // Ignore internal actions
    if (event.data.action === 'open-instrument-drawer') return;

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
    board.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b; font-style:italic;">Carregando dados...</div>';

    try {
        await loadStages();
        const r = await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/INSTRUMENTS/records`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        const data = await r.json();
        currentRecords = data.records.map(rec => ({ id: rec.id, ...rec.fields }));
    } catch (err) {
        console.error("Erro ao buscar registros para o Kanban:", err);
        board.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">Falha ao carregar dados do Grist: ${err.message}</div>`;
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

        // Card click selection - Relays drawer open command to UniversalViewer nested iframe
        card.addEventListener('click', () => {
            // Highlight selected card
            document.querySelectorAll('.instrument-card').forEach(c => c.style.borderColor = '#e2e8f0');
            card.style.borderColor = 'var(--primary)';

            const viewerIframe = document.querySelector('#pane-inventario iframe');
            if (viewerIframe && viewerIframe.contentWindow) {
                viewerIframe.contentWindow.postMessage({
                    action: 'open-instrument-drawer',
                    recordId: inst.id
                }, '*');
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

                    try {
                        // Save changes to Grist
                        await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/INSTRUMENTS/records`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                records: [{ id: recordId, fields: updates }]
                            })
                        });
                        console.log(`Registro ${recordId} updated.`);
                        
                        // History Log
                        const occurrenceData = {
                            ID_INSTRUMENT: recordId,
                            DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                            REAL_DATE: new Date().toISOString().split('T')[0] + 'T12:00:00Z',
                            COMMENTS: `Estágio logístico alterado no Kanban para: ${targetStage}`,
                            ID_SITUATION: 1
                        };
                        
                        await fetch(`${BASE_URL}/docs/${DOC_ID}/tables/INSTRUMENTS_OCCURRENCES/records`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                records: [{ fields: occurrenceData }]
                            })
                        });
                    } catch (e) {
                        console.error("Falha ao salvar alteração de estágio no Grist:", e);
                        renderKanban();
                    }
                }
            }
        });
    });
}
