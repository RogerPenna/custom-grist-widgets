// libraries/grist-drawer-component/drawer-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { openModal } from '../grist-modal-component/modal-component.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

let drawerPanel, drawerOverlay;
let currentTableId, currentRecordId;
let currentSchema = {};
let currentDrawerOptions = {};
let isEditing = false;
let currentRecord = null;
let isOpen = false;

// Motores de dados
let tableLens, dataWriter;

// --- SISTEMA DE DIAGNÓSTICO DE PERFORMANCE ---
let perfStartTime = 0;
function logPerf(stage) {
    const elapsed = (performance.now() - perfStartTime).toFixed(0);
    console.log(`[Drawer Perf] ${stage} em ${elapsed}ms`);
    const statusEl = document.getElementById('grf-drawer-perf-status');
    if (statusEl) statusEl.textContent = `Progresso: ${stage} (${elapsed}ms)`;
}

function _ensureTools(options = {}) {
    if (options.tableLens) {
        tableLens = options.tableLens;
    } else if (!tableLens) {
        try { tableLens = new GristTableLens(window.grist); } catch (e) { console.warn("[Drawer] Falha ao criar TableLens", e); }
    }
    if (options.dataWriter) {
        dataWriter = options.dataWriter;
    } else if (!dataWriter) {
        try { dataWriter = new GristDataWriter(window.grist); } catch (e) { console.warn("[Drawer] Falha ao criar DataWriter", e); }
    }
}

// --- INTERFACE ---

function _switchToTab(tabElement, panelElement) {
    if (!drawerPanel) return;
    drawerPanel.querySelectorAll('.drawer-tab').forEach(t => {
        t.classList.remove('is-active');
        t.style.color = '#64748b';
        t.style.borderBottomColor = 'transparent';
    });
    drawerPanel.querySelectorAll('.drawer-tab-content').forEach(p => p.style.display = 'none');
    
    tabElement.classList.add('is-active');
    tabElement.style.color = '#3b82f6';
    tabElement.style.borderBottomColor = '#3b82f6';
    panelElement.style.display = 'block';
}

function _updateButtonVisibility() {
    if (!drawerPanel) return;
    const editBtn = drawerPanel.querySelector('#drawer-edit-btn');
    const deleteBtn = drawerPanel.querySelector('#drawer-delete-btn');
    const saveBtn = drawerPanel.querySelector('#drawer-save-btn');
    const cancelBtn = drawerPanel.querySelector('#drawer-cancel-btn');

    if (currentRecordId === 'new') {
        if (editBtn) editBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
    } else {
        if (editBtn) editBtn.style.display = isEditing ? 'none' : 'inline-block';    
        if (deleteBtn) deleteBtn.style.display = isEditing ? 'none' : 'inline-block';  
        if (saveBtn) saveBtn.style.display = isEditing ? 'inline-block' : 'none';
        if (cancelBtn) cancelBtn.style.display = isEditing ? 'inline-block' : 'none';  
    }
}

async function _handleSave() {
    const changes = {};
    const formElements = drawerPanel.querySelectorAll('[data-col-id]');
    
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        const colSchema = currentSchema[colId];
        if (!colSchema || colSchema.isFormula) return;

        let value;
        if (el.type === 'checkbox') {
            value = el.checked;
        } else if (el.tagName === 'SELECT' && el.multiple) {
            const selectedOptions = Array.from(el.selectedOptions).map(opt => opt.value);
            value = selectedOptions.length > 0 ? ['L', ...selectedOptions] : null;
        } else if (colSchema.type.startsWith('Date')) {
            if (!el.value) value = null;
            else if (colSchema.type === 'Date') {
                const parts = el.value.split('-');
                value = Date.UTC(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2])) / 1000;
            } else {
                value = new Date(el.value).getTime() / 1000;
            }
        } else if (colSchema.type.startsWith('Ref')) {
            value = el.value ? Number(el.value) : 0;
        } else if (colSchema.type === 'Numeric' || colSchema.type === 'Int') {
            value = el.value !== '' ? Number(el.value) : null;
        } else {
            value = el.value;
        }
        changes[colId] = value;
    });

    try {
        if (currentRecordId === 'new') {
            await dataWriter.addRecord(currentTableId, changes);
            publish('data-changed', { tableId: currentTableId, action: 'add' });
            closeDrawer();
        } else if (Object.keys(changes).length > 0) {
            await dataWriter.updateRecord(currentTableId, currentRecordId, changes);
            publish('data-changed', { tableId: currentTableId, recordId: currentRecordId, action: 'update' });
            isEditing = false;
            await _renderDrawerContent();
            _updateButtonVisibility();
        }
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

async function _renderDrawerContent() {
    if (!drawerPanel) return;
    const tabsContainer = drawerPanel.querySelector('.drawer-tabs');
    const panelsContainer = drawerPanel.querySelector('.drawer-tab-panels');
    
    tabsContainer.innerHTML = ''; 
    panelsContainer.innerHTML = '<div style="padding:20px; color:#666;">Carregando...</div>';

    // O objeto 'currentDrawerOptions' agora vem do GristTableLens.parseConfigRecord, 
    // que já mesclou mapping, styling e actions.
    const config = currentDrawerOptions || {};
    console.log("[Drawer] Configuração recebida:", config);
    
    // Suporte para tripartição: mapping contém tabs e definições de campos
    const tabs = config.tabs || config.mapping?.tabs || null;
    const styleOverrides = config.styleOverrides || config.mapping?.styleOverrides || {};
    const widgetOverrides = config.widgetOverrides || config.mapping?.widgetOverrides || {};
    const fieldOptions = config.fieldOptions || config.mapping?.fieldOptions || {};
    const hiddenFields = config.hiddenFields || config.mapping?.hiddenFields || [];
    const lockedFields = config.lockedFields || config.mapping?.lockedFields || [];

    console.log("[Drawer] Diagnóstico de Mapeamento:", { 
        hasTabs: !!tabs, 
        numTabs: tabs?.length || 0,
        hiddenFieldsCount: hiddenFields.length,
        hiddenFields: hiddenFields,
        hasWidgetOverrides: Object.keys(widgetOverrides).length > 0
    });

    try {
        logPerf("Iniciando Busca de Schema");
        const schema = await tableLens.getTableSchema(currentTableId);
        currentSchema = schema;
        logPerf("Schema Recebido");

        if (currentRecordId === 'new') {
            currentRecord = currentRecord || {};
        } else {
            logPerf("Buscando Registro");
            currentRecord = await tableLens.fetchRecordById(currentTableId, currentRecordId);
            logPerf("Registro Recebido");
        }

        panelsContainer.innerHTML = '';
        
        // Se não houver abas configuradas, mostramos todos os campos não técnicos e NÃO OCULTOS
        const finalTabs = (tabs && tabs.length > 0) ? tabs : [{ 
            title: "Principal", 
            fields: Object.keys(schema).filter(id => {
                const isTechnical = id.startsWith('gristHelper_') || id === 'id' || schema[id].type === 'ManualSortPos';
                const isHidden = hiddenFields.includes(id);
                return !isTechnical && !isHidden;
            })
        }];

        finalTabs.forEach((tabConfig, index) => {
            const tabEl = document.createElement('div');
            tabEl.className = 'drawer-tab';
            tabEl.style.cssText = "cursor:pointer; font-weight:700; font-size:13px; color:#64748b; padding-bottom:8px; border-bottom:2px solid transparent; transition:all 0.2s; white-space:nowrap;";
            tabEl.textContent = tabConfig.title;
            tabsContainer.appendChild(tabEl);

            const panelEl = document.createElement('div');
            panelEl.className = 'drawer-tab-content';
            panelEl.style.display = 'none';
            panelsContainer.appendChild(panelEl);

            tabEl.onclick = () => _switchToTab(tabEl, panelEl);
            if (index === 0) _switchToTab(tabEl, panelEl);

            tabConfig.fields.forEach(fieldId => {
                const col = schema[fieldId];
                if (!col) return;
                
                // Pular se o campo estiver na lista de ocultos (Workflow ou Config)
                if (hiddenFields.includes(fieldId)) return;

                const row = document.createElement('div');
                row.className = 'drawer-field-row';
                row.dataset.colId = fieldId;
                row.style.marginBottom = '20px';
                row.innerHTML = `
                    <label style="display:block; font-weight:800; font-size:11px; color:#94a3b8; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.025em;">
                        ${col.label || col.colId}
                    </label>
                    <div class="field-val" style="min-height:24px; font-size:14px; color:#1e293b;"></div>
                `;
                panelEl.appendChild(row);

                // Normalização de opções para o renderer
                const widgetCfg = widgetOverrides[fieldId] || {};
                const fOpts = fieldOptions[fieldId] || {};
                
                // Mapeamos para o formato que o grist-field-renderer espera
                const mergedFieldConfig = {
                    widget: widgetCfg.widget || (fOpts.colorPicker ? 'Color Picker' : (fOpts.progressBar ? 'Progress Bar' : null)),
                    widgetOptions: widgetCfg.options || fOpts,
                    styleOverride: styleOverrides[fieldId] || {}
                };

                renderField({
                    container: row.querySelector('.field-val'),
                    colSchema: col,
                    record: currentRecord,
                    isEditing: isEditing,
                    isLocked: lockedFields.includes(fieldId),
                    tableLens: tableLens,
                    fieldStyle: mergedFieldConfig // Passamos como fieldStyle (novo padrão)
                });
            });
        });
        
        logPerf("Renderização Finalizada");
        
        // Listener de interatividade
        setTimeout(() => {
            const inputs = drawerPanel.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    logPerf("INTERAÇÃO DETECTADA (TTI)");
                }, { once: true });
            });
        }, 100);

    } catch (e) {
        logPerf(`ERRO: ${e.message}`);
        panelsContainer.innerHTML = `<div style="color:red; padding:20px; background:#fee2e2; border-radius:8px;">Erro: ${e.message}</div>`;
    }
}

// --- INICIALIZAÇÃO ---

function _initializeDrawerDOM() {
    drawerPanel = document.getElementById('grist-drawer-panel');
    drawerOverlay = document.getElementById('grist-drawer-overlay');

    if (drawerPanel) return;

    drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'grist-drawer-overlay';
    drawerOverlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:2147483640; display:none; backdrop-filter:blur(2px);";

    drawerPanel = document.createElement('div');
    drawerPanel.id = 'grist-drawer-panel';
    drawerPanel.style.cssText = "position:fixed; top:0; right:-650px; width:600px; height:100%; background:white; z-index:2147483641; transition:right 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:-5px 0 25px rgba(0,0,0,0.15); display:flex; flex-direction:column; font-family:sans-serif;";

    drawerPanel.innerHTML = `
        <div class="drawer-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <h2 id="drawer-title" style="margin:0; font-size:18px; font-weight:800; color:#1e293b;"></h2>
            <div class="drawer-header-actions" style="display:flex; gap:10px; align-items:center;">
                <div id="grf-drawer-perf-status" style="font-size:10px; color:#999; margin-right:10px;"></div>
                <div class="drawer-header-buttons" style="display:flex; gap:8px;">
                    <button id="drawer-delete-btn" title="Deletar" style="background:none; border:none; cursor:pointer;"><svg class="icon" style="width:20px; height:20px; stroke:#64748b; fill:none; stroke-width:2;"><use href="#icon-trashbin"></use></svg></button>
                    <button id="drawer-edit-btn" title="Editar" style="background:none; border:none; cursor:pointer;"><svg class="icon" style="width:20px; height:20px; stroke:#64748b; fill:none; stroke-width:2;"><use href="#icon-edit"></use></svg></button>
                    <button id="drawer-save-btn" title="Salvar" style="display:none; background:none; border:none; cursor:pointer;"><svg class="icon" style="width:20px; height:20px; stroke:#3b82f6; fill:none; stroke-width:2;"><use href="#icon-save"></use></svg></button>
                    <button id="drawer-cancel-btn" title="Cancelar" style="display:none; background:none; border:none; cursor:pointer;"><svg class="icon" style="width:20px; height:20px; stroke:#ef4444; fill:none; stroke-width:2;"><use href="#icon-close-circle"></use></svg></button>
                </div>
                <button class="drawer-close-btn" style="background:none; border:none; font-size:24px; cursor:pointer; color:#999;">&times;</button>
            </div>
        </div>
        <div class="drawer-body" style="flex:1; overflow-y:auto; padding:20px;">
            <div class="drawer-tabs" style="display:flex; gap:15px; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px;"></div>
            <div class="drawer-tab-panels"></div>
        </div>`;

    document.body.appendChild(drawerOverlay);
    document.body.appendChild(drawerPanel);

    drawerPanel.querySelector('.drawer-close-btn').onclick = () => closeDrawer();
    drawerOverlay.onclick = () => closeDrawer();
    
    drawerPanel.querySelector('#drawer-edit-btn').onclick = () => { isEditing = true; _renderDrawerContent(); _updateButtonVisibility(); };
    drawerPanel.querySelector('#drawer-cancel-btn').onclick = () => { 
        if (currentRecordId === 'new') closeDrawer();
        else { isEditing = false; _renderDrawerContent(); _updateButtonVisibility(); }
    };
    drawerPanel.querySelector('#drawer-save-btn').onclick = () => _handleSave();
    drawerPanel.querySelector('#drawer-delete-btn').onclick = async () => {
        if (confirm("Deseja deletar este registro?")) {
            await dataWriter.deleteRecords(currentTableId, [currentRecordId]);
            publish('data-changed', { tableId: currentTableId, recordId: currentRecordId, action: 'delete' });
            closeDrawer();
        }
    };
    
    drawerPanel.onclick = (e) => e.stopPropagation();
}

export async function openDrawer(tableId, recordId, options = {}) {
    perfStartTime = performance.now();
    logPerf("Chamada openDrawer");
    
    _ensureTools(options);
    _initializeDrawerDOM();
    
    currentTableId = tableId;
    currentRecordId = recordId;
    currentDrawerOptions = options;
    isEditing = (recordId === 'new' || options.mode === 'edit');

    if (recordId === 'new') {
        currentRecord = options.initialData || {};
    }

    drawerOverlay.style.setProperty('display', 'block', 'important');
    
    setTimeout(() => {
        if (drawerPanel) drawerPanel.style.setProperty('right', '0px', 'important');
        isOpen = true;
    }, 50);

    const titleEl = drawerPanel.querySelector('#drawer-title');
    if (titleEl) {
        titleEl.textContent = recordId === 'new' ? 'Novo Registro' : `Registro #${recordId}`;
    }
    
    _updateButtonVisibility();
    await _renderDrawerContent();
}

export function closeDrawer() {
    if (!drawerPanel) {
        drawerPanel = document.getElementById('grist-drawer-panel');
        drawerOverlay = document.getElementById('grist-drawer-overlay');
    }
    if (!drawerPanel) return;

    drawerPanel.style.setProperty('right', '-650px', 'important');
    setTimeout(() => {
        if (drawerOverlay) drawerOverlay.style.setProperty('display', 'none', 'important');
        isOpen = false;
    }, 300);
}

window.GristDrawer = {
    open: openDrawer,
    close: closeDrawer
};
