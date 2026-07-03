import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../libraries/grist-data-writer.js';

let tableLens = null;
let dataWriter = null;
let currentRecords = [];
let selectedRecordId = null;

// Pipeline stages definition
const STAGES = [
    "1. Planejado",
    "2. Orçamento",
    "3. Notificar Responsável",
    "4. Recebido na Matriz",
    "5. Enviado ao Laboratório",
    "6. Retornado (Importar Laudo)"
];

// Proxy Grist messages to and from nested iframes to resolve handshake on nested structures
window.addEventListener('message', (event) => {
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

tableLens = new GristTableLens(window.grist);
dataWriter = new GristDataWriter(window.grist);

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

// Start Grist
grist.ready({ requiredAccess: 'full' });

// Load full inventory
grist.onRecords(async (records) => {
    if (!records) return;
    currentRecords = records;
    
    // If on the Kanban tab, re-render it when data changes
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    if (activeTab === 'fluxo') {
        renderKanban();
    }
});

// Share selection
grist.onRecord(async (record) => {
    if (record && record.id) {
        selectedRecordId = record.id;
    }
});

async function renderKanban() {
    const board = document.getElementById('kanban-board-container');
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
        // Resolve stage (if null/undefined, put in "1. Planejado")
        let stage = inst.METROLOGICAL_STAGE || "1. Planejado";
        if (!STAGES.includes(stage)) {
            stage = "1. Planejado";
        }

        counts[stage]++;

        const card = document.createElement('div');
        card.className = 'instrument-card';
        card.dataset.id = inst.id;

        // Casing and resolution fallback
        const code = inst.CODE || `Instrumento #${inst.id}`;
        const type = inst.z_disp_ID_INSTRUMENT_TYPE || inst.ID_INSTRUMENT_TYPE || 'Sem Tipo';
        const model = inst.z_disp_ID_INSTRUMENT_MODEL || inst.ID_INSTRUMENT_MODEL || 'Sem Modelo';
        const resp = inst.z_disp_ID_RESPONSIBLE || inst.ID_RESPONSIBLE || 'Não Atribuído';
        const status = inst.z_disp_ID_STATUS || inst.ID_STATUS || 'Disponível';
        
        let statusClass = 'disponivel';
        if (status.toLowerCase().includes('laborat')) {
            statusClass = 'laboratorio';
        } else if (status.toLowerCase().includes('emprest')) {
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
                <span class="card-badge">${inst.NEXT_CALIBRATION ? inst.NEXT_CALIBRATION.split('T')[0] : 'S/ Data'}</span>
            </div>
        `;

        // Card click selection
        card.addEventListener('click', () => {
            grist.setSelectedRows([inst.id]);
            selectedRecordId = inst.id;
            
            // Highlight selected card
            document.querySelectorAll('.instrument-card').forEach(c => c.style.borderColor = '#e2e8f0');
            card.style.borderColor = 'var(--primary)';
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
                    
                    // Pre-calculate status changes automatically based on stage
                    const updates = { METROLOGICAL_STAGE: targetStage };
                    
                    if (targetStage.includes("5. Enviado")) {
                        // "Em Laboratório Externo" (ID 3 based on query)
                        updates.ID_STATUS = 3;
                    } else if (targetStage.includes("1. Planejado")) {
                        // "Disponível" (ID 1 based on query)
                        updates.ID_STATUS = 1;
                    }

                    try {
                        await dataWriter.updateRecord('INSTRUMENTS', recordId, updates);
                        console.log(`Registro ${recordId} atualizado com sucesso no Grist.`);
                    } catch (e) {
                        console.error("Falha ao salvar alteração de estágio no Grist:", e);
                        // Re-render to restore visual state if failed
                        renderKanban();
                    }
                }
            }
        });
    });
}
