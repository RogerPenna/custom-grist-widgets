// widgets/CardViewer.js - VERSÃO UNIVERSAL DEFINITIVA (FIX: THEME & PERSISTENCE)
import { GristTableLens } from '../libraries/grist-table-lens/grist-table-lens.js';
import { open as openConfigManager } from '../libraries/grist-config-manager/ConfigManagerComponent.js';
import { CardSystem } from '../libraries/grist-card-system/CardSystem.js';
import { subscribe } from '../libraries/grist-event-bus/grist-event-bus.js';
import { openDrawer } from '../libraries/grist-drawer-component/drawer-component.js';
import { GristRestAdapter } from '../libraries/headless-rest-adapter.js';
import { HeadlessTableLens } from '../libraries/headless-table-lens.js';
import { GristFilterBar } from '../libraries/grist-filter-bar/grist-filter-bar.js';

document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');
    const cardsContentArea = document.getElementById('cards-content-area');
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfigId = urlParams.get('configId');
    const urlDocId = urlParams.get('docId') || 'qiVPiRA3ULcU';

    let tableLens;
    let currentConfig = null;
    let currentConfigId = urlConfigId || null;
    let currentTheme = 'light';
    let isInitialized = false;

    // --- 1. DETECÇÃO DE AMBIENTE ---
    if (urlConfigId) {
        console.log("[CardViewer] Modo Headless Ativo.");
        const restAdapter = new GristRestAdapter({
            gristUrl: window.location.origin + '/grist-proxy',
            docId: urlDocId,
            apiKey: 'none'
        });
        tableLens = new HeadlessTableLens(restAdapter);
    } else {
        console.log("[CardViewer] Modo Grist Standard.");
        tableLens = new GristTableLens(window.grist);
    }

    // --- 2. INICIALIZAÇÃO DA BARRA DE FILTROS ---
    const filterBarContainer = document.getElementById('filter-bar-container');
    if (filterBarContainer) {
        try {
            const response = await fetch('../libraries/grist-filter-bar/grist-filter-bar.html');
            if (response.ok) {
                filterBarContainer.innerHTML = await response.text();
                new GristFilterBar({
                    onFilter: (searchTerm) => CardSystem.filterRecords(searchTerm)
                });
            }
        } catch (e) { console.error('Erro ao carregar barra de filtros:', e); }
    }

    // --- 3. CARREGAMENTO DE ÍCONES ---
    async function loadIcons() {
        try {
            const response = await fetch('../libraries/icons/icons.svg');
            if (!response.ok) throw new Error("Status " + response.status);
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (e) { 
            console.warn('Tentando caminho relativo para ícones...');
            try {
                const response = await fetch('../libraries/icons/icons.svg');
                const svgText = await response.text();
                const div = document.createElement('div');
                div.style.display = 'none';
                div.innerHTML = svgText;
                document.body.insertBefore(div, document.body.firstChild);
            } catch (e2) { console.error('Falha crítica nos ícones:', e2); }
        }
    }
    await loadIcons();

    // --- 4. LÓGICA DE RENDERIZAÇÃO ---
    async function initializeAndUpdate() {
        document.body.classList.remove('night-theme', 'light-theme');
        document.body.classList.add(`${currentTheme}-theme`);

        if (!urlConfigId) addSettingsGear();

        if (!currentConfigId) {
            cardsContentArea.innerHTML = '<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            return;
        }

        cardsContentArea.innerHTML = '<div class="status-placeholder">Carregando dados...</div>';

        try {
            currentConfig = await tableLens.fetchConfig(currentConfigId);
            if (!currentConfig) {
                cardsContentArea.innerHTML = `<div class="status-placeholder">Configuração "${currentConfigId}" não encontrada.</div>`;
                return;
            }

            const tableId = currentConfig.tableId;

            const [records, cleanSchema, rawSchema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId),
                tableLens.getTableSchema(tableId, { mode: 'raw' })
            ]);

            Object.keys(cleanSchema).forEach(colId => {
                if (rawSchema[colId] && rawSchema[colId].description) {
                    cleanSchema[colId].description = rawSchema[colId].description;
                }
            });

            cardsContentArea.innerHTML = '';

            // Lógica para Estado Vazio (Empty State)
            if (records.length === 0) {
                const showAddTop = currentConfig.showAddButtonTop || currentConfig.actions?.showAddButtonTop;
                const showAddBottom = currentConfig.showAddButtonBottom || currentConfig.actions?.showAddButtonBottom;

                if (showAddTop || showAddBottom) {
                    const empty = document.createElement('div');
                    empty.className = 'empty-state-container';
                    empty.innerHTML = `<p style="font-size:12px; font-weight:600; margin-bottom:10px;">Nenhum registro encontrado</p>`;
                    empty.appendChild(createAddButton('empty'));
                    cardsContentArea.appendChild(empty);
                } else {
                    cardsContentArea.innerHTML = '<div class="status-placeholder">Nenhum registro encontrado.</div>';
                }
                return;
            }

            // 1. Botão Topo (Discreto)
            if (currentConfig.showAddButtonTop || currentConfig.actions?.showAddButtonTop) {
                cardsContentArea.appendChild(createAddButton('top'));
            }

            // 2. Cards
            const cardsWrapper = document.createElement('div');
            cardsWrapper.className = 'cards-wrapper';
            CardSystem.renderCards(cardsWrapper, records, { ...currentConfig, tableLens }, cleanSchema); 
            cardsContentArea.appendChild(cardsWrapper);

            // 3. Botão Rodapé (Discreto)
            if (currentConfig.showAddButtonBottom || currentConfig.actions?.showAddButtonBottom) {
                cardsContentArea.appendChild(createAddButton('bottom'));
            }

        } catch (e) {
            console.error(e);
            cardsContentArea.innerHTML = `<div class="status-placeholder" style="color:red">Erro: ${e.message}</div>`;
        }
    }

    function createAddButton(position) {
        const btn = document.createElement('button');
        btn.className = `grf-global-add-btn pos-${position}`;
        btn.title = "Adicionar Novo Registro";
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 5V19M5 12H19" stroke="currentColor"/></svg>`;
        btn.onclick = async (e) => {
            e.stopPropagation();
            let addConfig = currentConfig;
            // Busca nas duas localizações possíveis (legado e tripartição)
            const specificConfigId = currentConfig.addRecordConfigId || currentConfig.actions?.addRecordConfigId;
            
            if (specificConfigId) {
                const rec = await tableLens.findRecord('Grf_config', { configId: specificConfigId });
                if (rec) addConfig = tableLens.parseConfigRecord(rec);
            }

            if (window.GristDrawer) {
                window.GristDrawer.open(currentConfig.tableId, 'new', { ...addConfig, tableLens });
            }
        };
        return btn;
    }

    // --- 5. UI DE CONFIGURAÇÃO ---
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.title = 'Configurações';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    function openSettingsPopover(event) {
        event.stopPropagation();
        const existing = document.querySelector('.config-popover');
        if (existing) { existing.remove(); return; }

        const popover = document.createElement('div');
        popover.className = 'config-popover';
        
        // O tema só aparece no modo Headless para testes. No Grist, focamos no ID.
        const themeSection = urlConfigId ? `
            <div class="popover-section">
                <label>Tema (Preview)</label>
                <div class="theme-toggle-group">
                    <button id="theme-night-btn" class="${currentTheme === 'night' ? 'active' : ''}">Escuro</button>
                    <button id="theme-light-btn" class="${currentTheme === 'light' ? 'active' : ''}">Claro</button>
                </div>
            </div>` : '';

        popover.innerHTML = `
            <div class="popover-section">
                <label>ID de Configuração</label>
                <input type="text" id="popover-config-id" value="${currentConfigId || ''}" placeholder="Ex: GestMud_123">
            </div>
            ${themeSection}
            <button id="popover-link-btn" class="config-popover-btn">Salvar Vínculo</button>
            <button id="popover-mgr-btn" class="config-popover-btn" style="background:#64748b;">Abrir Configurador</button>
        `;
        document.body.appendChild(popover);

        popover.querySelector('#popover-link-btn').onclick = () => {
            const newId = document.getElementById('popover-config-id').value.trim();
            if (urlConfigId) {
                alert("No Modo Headless, altere via menu do Dashboard.");
            } else {
                // Ao salvar no Grist, enviamos o objeto completo para não perder nada
                window.grist.setOptions({ 
                    configId: newId,
                    theme: currentTheme 
                });
            }
            popover.remove();
        };

        if (urlConfigId) {
            popover.querySelector('#theme-night-btn').onclick = () => {
                currentTheme = 'night';
                initializeAndUpdate();
                popover.remove();
            };
            popover.querySelector('#theme-light-btn').onclick = () => {
                currentTheme = 'light';
                initializeAndUpdate();
                popover.remove();
            };
        }

        popover.querySelector('#popover-mgr-btn').onclick = () => {
            popover.remove();
            openConfigManager(window.grist, { initialConfigId: currentConfigId, componentTypes: ['Card System'] });
        };
    }

    // --- 6. EVENTOS E SUBSCRIPÇÕES ---
    window.grist.ready({ requiredAccess: 'full' });

    if (urlConfigId) {
        isInitialized = true;
        await initializeAndUpdate();
    }

    window.grist.onOptions(async (options) => {
        const newId = options?.configId || null;
        const newTheme = options?.theme || 'light';
        
        if (newId !== currentConfigId || newTheme !== currentTheme || !isInitialized) {
            isInitialized = true;
            currentConfigId = newId;
            currentTheme = newTheme;
            await initializeAndUpdate();
        }
    });

    subscribe('grf-card-clicked', async (data) => {
        try {
            console.log("[CardViewer] Card clicado:", data);
            let drawerConfig = {};
            
            if (data.drawerConfigId) {
                // Se houver um ID específico, buscamos
                drawerConfig = await tableLens.fetchConfig(data.drawerConfigId);
            } else {
                // Se não houver, usamos a config do widget atual como base (Default Drawer)
                drawerConfig = currentConfig;
            }

            if (window.GristDrawer) {
                await window.GristDrawer.open(data.tableId, data.recordId, { 
                    ...drawerConfig, 
                    tableLens: tableLens 
                });
            }
        } catch (e) { console.error("Erro ao abrir drawer:", e); }
    });

    // Reage a mudanças disparadas internamente (ex: salvar na gaveta)
    subscribe('data-changed', async () => {
        console.log("[CardViewer] Mudança de dados detectada via EventBus. Atualizando...");
        await initializeAndUpdate();
    });

    // Reage a mudanças no banco de dados do Grist (nativo)
    window.grist.onRecords(async () => {
        if (isInitialized) {
            console.log("[CardViewer] onRecords disparado. Atualizando interface...");
            await initializeAndUpdate();
        }
    });
});
