// widgets/CardViewer.js - VERSÃO UNIVERSAL DEFINITIVA (MODO GRIST + HEADLESS)
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
    const urlParams = new URLSearchParams(window.location.search);
    const urlConfigId = urlParams.get('configId');
    const urlDocId = urlParams.get('docId') || 'qiVPiRA3ULcU';

    let tableLens;
    let currentConfig = null;
    let currentConfigId = urlConfigId || null;
    let currentTheme = 'night';
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
        tableLens = new GristTableLens(grist);
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
            const response = await fetch('/libraries/icons/icons.svg');
            const svgText = await response.text();
            const div = document.createElement('div');
            div.style.display = 'none';
            div.innerHTML = svgText;
            document.body.insertBefore(div, document.body.firstChild);
        } catch (e) { console.error('Falha ao carregar ícones:', e); }
    }
    await loadIcons();

    // --- 4. LÓGICA DE RENDERIZAÇÃO ---
    async function initializeAndUpdate() {
        // Aplica o tema
        document.body.classList.remove('night-theme', 'light-theme');
        document.body.classList.add(`${currentTheme}-theme`);

        if (!currentConfigId) {
            appContainer.innerHTML = '<div class="status-placeholder">Widget pronto. Use a engrenagem ⚙️ para vincular um ID de configuração.</div>';
            addSettingsGear();
            return;
        }

        appContainer.innerHTML = '<div class="status-placeholder">Carregando dados...</div>';

        try {
            const configRecord = await tableLens.findRecord('Grf_config', { configId: currentConfigId });
            if (!configRecord) {
                appContainer.innerHTML = `<div class="status-placeholder">Erro: Configuração "${currentConfigId}" não encontrada.</div>`;
                addSettingsGear();
                return;
            }

            currentConfig = JSON.parse(configRecord.configJson);
            const tableId = currentConfig.tableId;

            const [records, cleanSchema, rawSchema] = await Promise.all([
                tableLens.fetchTableRecords(tableId),
                tableLens.getTableSchema(tableId),
                tableLens.getTableSchema(tableId, { mode: 'raw' })
            ]);

            // Enriquece o schema com descrições
            Object.keys(cleanSchema).forEach(colId => {
                if (rawSchema[colId] && rawSchema[colId].description) {
                    cleanSchema[colId].description = rawSchema[colId].description;
                }
            });

            appContainer.innerHTML = '';
            CardSystem.renderCards(appContainer, records, { ...currentConfig, tableLens }, cleanSchema); 
            addSettingsGear();

        } catch (e) {
            console.error(e);
            appContainer.innerHTML = `<div class="status-placeholder">Erro: ${e.message}</div>`;
            addSettingsGear();
        }
    }

    // --- 5. UI DE CONFIGURAÇÃO ---
    function addSettingsGear() {
        if (document.getElementById('settings-gear-btn')) return;
        const gearBtn = document.createElement('div');
        gearBtn.id = 'settings-gear-btn';
        gearBtn.innerHTML = '⚙️';
        gearBtn.title = 'Configurações do Widget';
        gearBtn.onclick = openSettingsPopover;
        document.body.appendChild(gearBtn);
    }

    function openSettingsPopover(event) {
        event.stopPropagation();
        closeSettingsPopover();
        const popover = document.createElement('div');
        popover.className = 'config-popover';
        popover.innerHTML = `
            <div class="popover-section">
                <label>Vincular ID de Configuração</label>
                <input type="text" id="popover-config-id" value="${currentConfigId || ''}" placeholder="Ex: GestMud_123">
            </div>
            <div class="popover-section">
                <label>Tema</label>
                <div class="theme-toggle-group">
                    <button id="theme-night-btn" class="config-popover-btn ${currentTheme === 'night' ? 'active' : ''}">Escuro</button>
                    <button id="theme-light-btn" class="config-popover-btn ${currentTheme === 'light' ? 'active' : ''}">Claro</button>
                </div>
            </div>
            <button id="popover-link-btn" class="config-popover-btn">Salvar Alterações</button>
            <button id="popover-mgr-btn" class="config-popover-btn" style="background:#64748b;">Abrir Configurador</button>
        `;
        document.body.appendChild(popover);

        popover.querySelector('#popover-link-btn').onclick = () => {
            const newId = document.getElementById('popover-config-id').value.trim();
            if (urlConfigId) {
                alert("No Dashboard, altere o ID nas configurações do portal.");
            } else {
                grist.setOptions({ configId: newId });
            }
            closeSettingsPopover();
        };

        popover.querySelector('#theme-night-btn').onclick = () => {
            if (!urlConfigId) grist.setOptions({ theme: 'night' });
            else { currentTheme = 'night'; initializeAndUpdate(); }
            closeSettingsPopover();
        };

        popover.querySelector('#theme-light-btn').onclick = () => {
            if (!urlConfigId) grist.setOptions({ theme: 'light' });
            else { currentTheme = 'light'; initializeAndUpdate(); }
            closeSettingsPopover();
        };

        popover.querySelector('#popover-mgr-btn').onclick = () => {
            closeSettingsPopover();
            openConfigManager(grist, { initialConfigId: currentConfigId, componentTypes: ['Card System'] });
        };
    }

    function closeSettingsPopover() {
        const p = document.querySelector('.config-popover');
        if (p) p.remove();
    }

    // --- 6. EVENTOS E SUBSCRIPÇÕES ---
    grist.ready({ requiredAccess: 'full' });

    if (urlConfigId) {
        isInitialized = true;
        await initializeAndUpdate();
    }

    grist.onOptions(async (options) => {
        const newId = options?.configId || null;
        const newTheme = options?.theme || 'night';
        if (newId !== currentConfigId || newTheme !== currentTheme || !isInitialized) {
            isInitialized = true;
            currentConfigId = newId;
            currentTheme = newTheme;
            await initializeAndUpdate();
        }
    });

    subscribe('grf-card-clicked', async (data) => {
        const rec = await tableLens.findRecord('Grf_config', { configId: data.drawerConfigId });
        if (rec) openDrawer(data.tableId, data.recordId, { ...JSON.parse(rec.configJson), tableLens });
    });

    subscribe('grf-navigation-action-triggered', async (eventData) => {
        const config = eventData.config;
        const sourceRecord = eventData.sourceRecord;
        if (config.actionType === 'openUrlFromColumn') {
            const url = sourceRecord[config.urlColumn];
            if (url) window.open(url, '_blank');
        } else if (config.actionType === 'navigateToGristPage') {
            alert(`Navegando para página ${config.targetPageId} (Filtro: ${config.targetFilterColumn}=${sourceRecord[config.sourceValueColumn]})`);
        }
    });
});
