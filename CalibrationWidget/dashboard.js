import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js?v=1.3.19';

let currentRecords = [];
let STAGES = [];
let currentDashboardConfig = null;

// --- CARREGAMENTO DE ÍCONES ---
async function loadIcons() {
    if (document.getElementById('grist-icons-sprite')) return;
    try {
        const response = await fetch('../libraries/icons/icons.svg');
        if (!response.ok) return;
        const svgText = await response.text();
        const div = document.createElement('div');
        div.id = 'grist-icons-sprite';
        div.style.display = 'none';
        div.innerHTML = svgText;
        document.body.insertBefore(div, document.body.firstChild);
    } catch (error) {
        console.warn('Falha ao carregar ícones no Dashboard:', error);
    }
}
loadIcons();


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
        
        const viewerIframe = document.querySelector('#pane-0 iframe') || document.querySelector('#pane-inventario iframe');
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

let ALL_CHOICES = [];

// Register data loaded handler for early head-registered proxy listener
window.onInstrumentsDataLoaded = (data) => {
    console.log("[Dashboard Debug] onInstrumentsDataLoaded received data:", data);
    currentRecords = data.records || [];
    const rawChoices = data.choices || [];
    ALL_CHOICES = rawChoices;
    STAGES = rawChoices.filter(c => c !== "0. Em Uso" && c !== "Em Uso" && c !== "-");
    console.log("[Dashboard Debug] Resolved STAGES list:", STAGES, "Records count:", currentRecords.length);
    
    // Safely check if the Kanban tab is active using either data-tab or data-tab-type
    const activeBtn = document.querySelector('.tab-btn.active');
    const activeTab = activeBtn ? activeBtn.getAttribute('data-tab') : '';
    const activeTabType = activeBtn ? activeBtn.getAttribute('data-tab-type') : '';
    console.log("[Dashboard Debug] Active tab detected:", activeTab, "Type:", activeTabType);
    
    if (activeTab === 'fluxo' || activeTabType === 'kanban') {
        renderKanban();
    }
};

// Handle any cached data received before dashboard.js loaded
if (window.cachedInstrumentsData) {
    window.onInstrumentsDataLoaded(window.cachedInstrumentsData);
}

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
    console.log("[Dashboard Debug] renderKanban executing. STAGES count:", STAGES.length, "Records count:", currentRecords.length);
    const board = document.getElementById('kanban-board-container');
    if (!board) {
        console.warn("[Dashboard Debug] kanban-board-container element not found in DOM.");
        return;
    }
    if (STAGES.length === 0) {
        console.warn("[Dashboard Debug] STAGES list is empty. Rendering fallback placeholder.");
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

        const isLastStage = stage === STAGES[STAGES.length - 1];

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
            ${isLastStage ? `
                <div class="card-complete-action" style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px; text-align: right;">
                    <button class="btn-complete-flow" style="background: var(--accent); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: opacity 0.2s;">
                        Concluir e Retornar ✓
                    </button>
                </div>
            ` : ''}
        `;

        // Card click selection - Opens Details Drawer directly on the parent window!
        card.addEventListener('click', async () => {
            document.querySelectorAll('.instrument-card').forEach(c => c.style.borderColor = '#e2e8f0');
            card.style.borderColor = 'var(--primary)';

            try {
                const mapping = currentDashboardConfig?.mapping || {};
                const drawerId = mapping.kanbanDrawerConfigId || "drawerinstruments";
                const drawerCfg = await mockTableLens.fetchConfig(drawerId);
                await openDrawer('INSTRUMENTS', inst.id, { 
                    ...drawerCfg, 
                    tableLens: mockTableLens,
                    dataWriter: mockDataWriter,
                    mode: drawerCfg?.mode || 'edit' // Default to edit mode so they can edit
                });
            } catch (err) {
                console.error("[Dashboard] Erro ao abrir gaveta de detalhes:", err);
            }
        });

        if (isLastStage) {
            const btnComplete = card.querySelector('.btn-complete-flow');
            if (btnComplete) {
                btnComplete.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Avoid opening the drawer!
                    btnComplete.disabled = true;
                    btnComplete.innerText = "Salvando...";
                    
                    const normalStage = ALL_CHOICES.find(c => c === '-' || c === '0. Em Uso') || '-';
                    try {
                        await mockDataWriter.updateRecord('INSTRUMENTS', inst.id, {
                            METROLOGICAL_STAGE: normalStage,
                            ID_STATUS: 1 // back to standard Active status
                        });
                    } catch (err) {
                        console.error("[Dashboard] Erro ao finalizar fluxo:", err);
                        btnComplete.disabled = false;
                        btnComplete.innerText = "Concluir e Retornar ✓";
                    }
                });
            }
        }

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

function renderDashboard(configRecord = null) {
    currentDashboardConfig = configRecord || {};
    const config = currentDashboardConfig;
    const styling = config.styling || config || {};
    const mapping = config.mapping || config || {};

    // 1. Apply colors to root variables
    const root = document.documentElement;
    if (styling.primaryColor) root.style.setProperty('--primary', styling.primaryColor);
    if (styling.hoverColor) root.style.setProperty('--primary-hover', styling.hoverColor);
    if (styling.accentColor) root.style.setProperty('--accent', styling.accentColor);
    if (styling.bgCanvas) root.style.setProperty('--bg-canvas', styling.bgCanvas);

    // 2. Apply title and version
    const titleEl = document.querySelector('.header-title h1');
    if (titleEl) {
        const versionSuffix = styling.version ? ` <span style="font-size:11px; opacity:0.75; margin-left:6px;">${styling.version}</span>` : '';
        titleEl.innerHTML = (styling.title || 'Painel Metrológico') + versionSuffix;
    }

    // 3. Render dynamic tabs
    const menuItems = mapping.menuItems || [
        { label: 'Inventário Geral', icon: 'icon-dashboard', type: 'viewer', targetConfigId: 'tableinstruments' },
        { label: 'Fluxo (Kanban)', icon: 'icon-column', type: 'kanban', targetConfigId: 'kanban' },
        { label: 'Importador', icon: 'icon-download', type: 'importador', targetConfigId: 'importador' },
        { label: 'Certificados Terceiros', icon: 'icon-settings', type: 'viewer', targetConfigId: 'tableexternalcalibrations' }
    ];

    const tabsNav = document.querySelector('.tabs-nav');
    const mainContainer = document.querySelector('main');

    if (!tabsNav || !mainContainer) return;

    // Check if the tabs structure is already identical to avoid reloading frames
    const existingButtons = Array.from(tabsNav.querySelectorAll('.tab-btn'));
    const isSameStructure = existingButtons.length === menuItems.length && menuItems.every((item, idx) => {
        const btn = existingButtons[idx];
        const labelLower = item.label.toLowerCase();
        let targetType = item.type || 'viewer';
        if (targetType !== 'submenu') {
            if (item.targetConfigId === 'kanban' || labelLower.includes('kanban') || labelLower.includes('fluxo')) {
                targetType = 'kanban';
            } else if (item.targetConfigId === 'importador' || labelLower.includes('importador')) {
                targetType = 'importador';
            }
        }
        const btnText = btn.querySelector('span') ? btn.querySelector('span').innerText : btn.innerText;
        return btnText === item.label && btn.getAttribute('data-tab-type') === targetType;
    });

    if (isSameStructure) {
        return;
    }

    tabsNav.innerHTML = '';
    mainContainer.innerHTML = '';

    menuItems.forEach((item, idx) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${idx === 0 ? 'active' : ''}`;
        btn.setAttribute('data-tab', `pane-${idx}`);
        
        let tabType = item.type || 'viewer';
        const labelLower = item.label.toLowerCase();
        if (tabType !== 'submenu') {
            if (item.targetConfigId === 'kanban' || labelLower.includes('kanban') || labelLower.includes('fluxo')) {
                tabType = 'kanban';
            } else if (item.targetConfigId === 'importador' || labelLower.includes('importador')) {
                tabType = 'importador';
            }
        }
        btn.setAttribute('data-tab-type', tabType);

        if (item.icon) {
            btn.innerHTML = `<svg style="width:14px; height:14px; fill:currentColor; margin-right:6px;"><use href="#${item.icon}"></use></svg><span>${item.label}</span>`;
        } else {
            btn.innerText = item.label;
        }

        const pane = document.createElement('div');
        pane.id = `pane-${idx}`;
        pane.className = `tab-pane ${idx === 0 ? 'active' : ''}`;

        if (tabType === 'kanban') {
            pane.innerHTML = `<div class="kanban-board" id="kanban-board-container"></div>`;
        } else if (tabType === 'importador') {
            pane.innerHTML = `<iframe src="./importador-calibracoes.html"></iframe>`;
        } else if (tabType === 'submenu') {
            const subItems = item.subItems || [];
            let cardsHtml = '';
            subItems.forEach((sub) => {
                cardsHtml += `
                    <div class="submenu-card" data-config-id="${sub.targetConfigId}" data-label="${sub.label}" style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; align-items: center; gap: 15px; border-left: 4px solid var(--primary);">
                        <div class="submenu-card-icon" style="background: var(--primary-light); color: var(--primary); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">⚙️</div>
                        <div style="flex:1;">
                            <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${sub.label}</div>
                            <div style="font-size: 11px; color: var(--text-sub);">Clique para configurar / ver</div>
                        </div>
                    </div>
                `;
            });

            pane.innerHTML = `
                <div class="submenu-viewport" style="display:flex; flex-direction:column; width:100%; height:100%; min-height:0; flex:1;">
                    <div class="submenu-grid-view" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(225px, 1fr)); gap: 20px; padding: 25px; overflow-y:auto; flex:1; min-height:0; align-content:start;">
                        ${cardsHtml || '<div style="grid-column:1/-1; text-align:center; color:#64748b; font-style:italic; padding:40px;">Nenhum atalho configurado para este sub-menu.</div>'}
                    </div>
                    <div class="submenu-detail-view" style="display:none; flex-direction:column; flex:1; min-height:0; width:100%; height:100%;">
                        <div class="submenu-detail-header" style="padding:10px 15px; background:#fff; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; gap:10px;">
                            <button class="btn-submenu-back" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">◀ Voltar para Menu</button>
                            <span class="submenu-detail-title" style="font-weight:700; font-size:13px; color:var(--text-main);">Configuração</span>
                        </div>
                        <div class="submenu-detail-iframe-container" style="flex:1; min-height:0; width:100%; height:100%;">
                            <iframe src="" style="width:100%; height:100%; border:none;"></iframe>
                        </div>
                    </div>
                </div>
            `;

            const gridView = pane.querySelector('.submenu-grid-view');
            const detailView = pane.querySelector('.submenu-detail-view');
            const detailTitle = pane.querySelector('.submenu-detail-title');
            const detailIframe = pane.querySelector('.submenu-detail-iframe-container iframe');
            const backBtn = pane.querySelector('.btn-submenu-back');

            pane.querySelectorAll('.submenu-card').forEach(card => {
                card.onclick = () => {
                    const cfgId = card.dataset.configId;
                    const label = card.dataset.label;
                    if (!cfgId) return;

                    gridView.style.display = 'none';
                    detailView.style.display = 'flex';
                    detailTitle.innerText = label;
                    detailIframe.src = `../UniversalViewer/index.html?configId=${cfgId}`;
                };
            });

            backBtn.onclick = () => {
                detailIframe.src = '';
                detailView.style.display = 'none';
                gridView.style.display = 'grid';
            };
        } else {
            pane.innerHTML = `<iframe src="../UniversalViewer/index.html?configId=${item.targetConfigId || ''}"></iframe>`;
        }

        btn.onclick = () => {
            tabsNav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            mainContainer.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            pane.classList.add('active');
            
            if (tabType === 'kanban') {
                renderKanban();
            } else if (tabType === 'submenu') {
                const gridView = pane.querySelector('.submenu-grid-view');
                const detailView = pane.querySelector('.submenu-detail-view');
                const detailIframe = pane.querySelector('.submenu-detail-iframe-container iframe');
                if (detailIframe) detailIframe.src = '';
                if (detailView) detailView.style.display = 'none';
                if (gridView) gridView.style.display = 'grid';
            }
        };

        tabsNav.appendChild(btn);
        mainContainer.appendChild(pane);
    });

    const firstItem = menuItems[0];
    if (firstItem && (firstItem.targetConfigId === 'kanban' || firstItem.label.toLowerCase().includes('kanban') || firstItem.label.toLowerCase().includes('fluxo'))) {
        renderKanban();
    }
}

window.onDashboardConfigLoaded = (configRecord) => {
    try {
        renderDashboard(configRecord);
    } catch(err) {
        console.error("[Dashboard] Error applying loaded configuration:", err);
    }
};

if (window.cachedDashboardConfig) {
    window.onDashboardConfigLoaded(window.cachedDashboardConfig);
}
