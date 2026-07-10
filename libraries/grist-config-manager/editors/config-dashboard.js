// libraries/grist-config-manager/editors/config-dashboard.js
export const DashboardConfigEditor = (() => {
    let _mainContainer = null;
    let _allConfigs = [];
    let _menuItems = [];
    let _iconPickerPopup = null;

    const AVAILABLE_ICONS = [
        "icon-CompassRose",
        "icon-activity-icon",
        "icon-adjustments",
        "icon-adjustments-vert",
        "icon-annotation",
        "icon-arrow-down-icon",
        "icon-arrow-down-left-icon",
        "icon-arrow-down-right-icon",
        "icon-arrow-left-icon",
        "icon-arrow-move",
        "icon-arrow-right-icon",
        "icon-arrow-up-icon",
        "icon-arrow-up-left-icon",
        "icon-arrow-up-right-icon",
        "icon-backhoe",
        "icon-badge-check",
        "icon-badge-check-icon",
        "icon-bar-chart",
        "icon-bar-chart-line",
        "icon-barcode",
        "icon-bars",
        "icon-bell",
        "icon-bell-active",
        "icon-book-open-check-icon",
        "icon-bookmark",
        "icon-building-icon",
        "icon-building2-icon",
        "icon-buildings",
        "icon-bulldozer",
        "icon-bullseye",
        "icon-calculator-icon",
        "icon-calendar",
        "icon-calendar-edit",
        "icon-card-checklist",
        "icon-chart",
        "icon-chart-gantt-icon",
        "icon-chart-mixed",
        "icon-chart-pie",
        "icon-chart-up",
        "icon-check",
        "icon-check-circle",
        "icon-check-circle-alt",
        "icon-checklist",
        "icon-chess-knight-icon",
        "icon-chess-pawn-icon",
        "icon-chess-rook-icon",
        "icon-circle-star-icon",
        "icon-clipboard",
        "icon-clipboard-check",
        "icon-clipboard-list",
        "icon-clock-arrow",
        "icon-close-circle",
        "icon-close-sidebar",
        "icon-column",
        "icon-compass",
        "icon-cone",
        "icon-cone-striped",
        "icon-crosshair-icon",
        "icon-diagram-2",
        "icon-diagram-3",
        "icon-download",
        "icon-edit",
        "icon-exclamation",
        "icon-exclamation-diamond",
        "icon-exclamation-triangle",
        "icon-expand",
        "icon-eye",
        "icon-factory-icon",
        "icon-file",
        "icon-file-chart",
        "icon-file-check",
        "icon-file-clone",
        "icon-file-search",
        "icon-filter",
        "icon-flag",
        "icon-flag-icon",
        "icon-folder",
        "icon-forward",
        "icon-globe",
        "icon-globe-americas",
        "icon-grid",
        "icon-hard-hat",
        "icon-hourglass",
        "icon-info-circle",
        "icon-kanban",
        "icon-land-plot-icon",
        "icon-landmark-icon",
        "icon-life-buoy-icon",
        "icon-lifesaver",
        "icon-lightbulb",
        "icon-lightning",
        "icon-link",
        "icon-link-broken",
        "icon-lock",
        "icon-math",
        "icon-medal-icon",
        "icon-microscope",
        "icon-minus-circle",
        "icon-minus-circle-alt",
        "icon-new",
        "icon-package-check-icon",
        "icon-package-open-icon",
        "icon-pen",
        "icon-pen-alt",
        "icon-pencil-ruler-icon",
        "icon-plus-circle",
        "icon-plus-circle-alt",
        "icon-pocket-knife-icon",
        "icon-printer",
        "icon-printer-icon",
        "icon-process",
        "icon-process-cogs",
        "icon-profile-card",
        "icon-rectangle-list",
        "icon-risk",
        "icon-ruler-dimension-line-icon",
        "icon-ruler-icon",
        "icon-ruler90",
        "icon-save",
        "icon-save-alt",
        "icon-search",
        "icon-settings",
        "icon-sheet-icon",
        "icon-shield-alert-icon",
        "icon-shovel-icon",
        "icon-speedometer",
        "icon-square-radical-icon",
        "icon-strategy",
        "icon-target-arrow",
        "icon-tool-case-icon",
        "icon-tools",
        "icon-tools2",
        "icon-traffic-cone-icon",
        "icon-traffic-light",
        "icon-trashbin",
        "icon-trophy-icon",
        "icon-truck",
        "icon-unlock",
        "icon-user-round-icon",
        "icon-variable",
        "icon-warehouse-icon",
        "icon-wrench",
        "icon-zoom-in",
        "icon-zoom-out"
        ];

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        _allConfigs = receivedConfigs;

        const options = config || {};
        const styling = options.styling || options || {};
        const mapping = options.mapping || options || {};

        // Load menu items
        _menuItems = Array.isArray(mapping.menuItems) ? JSON.parse(JSON.stringify(mapping.menuItems)) : [
            { label: 'Painel Geral', icon: 'icon-dashboard', type: 'viewer', targetConfigId: '' },
            { label: 'Fluxo (Kanban)', icon: 'icon-column', type: 'kanban', targetConfigId: 'kanban' },
            { label: 'Importador', icon: 'icon-download', type: 'importador', targetConfigId: 'importador' },
            { label: 'Configurações', icon: 'icon-settings', type: 'submenu', targetConfigId: '', subItems: [] }
        ];

        container.innerHTML = `
            <style>
                .dashboard-tab-item {
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 15px;
                    background: #fff;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    position: relative;
                }
                .dashboard-tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 6px;
                }
                .dashboard-tab-actions {
                    display: flex;
                    gap: 6px;
                }
                .dashboard-btn-icon {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 2px;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .dashboard-btn-delete {
                    color: #ef4444;
                }
                .dashboard-btn-move {
                    color: #475569;
                }
                .subitems-container {
                    margin-top: 10px;
                    padding-left: 15px;
                    border-left: 2px dashed #cbd5e1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .subitem-row {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
            </style>
            <div class="config-tabs">
                <button type="button" class="config-tab-button active" data-tab-id="design">Design & Cabeçalho</button>
                <button type="button" class="config-tab-button" data-tab-id="menu">Itens de Menu (Abas)</button>
            </div>
            <div id="dashboard-config-contents" style="margin-top: 15px;">
                <div data-tab-section="design">
                    <h3>Design & Identidade</h3>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Título do Painel:</label>
                        <input type="text" id="dash-title" class="form-control" value="${styling.title || 'Painel Metrológico'}" style="width:100%; padding:6px; box-sizing:border-box;">
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Indicador de Versão:</label>
                        <input type="text" id="dash-version" class="form-control" value="${styling.version || 'v1.1.0'}" style="width:100%; padding:6px; box-sizing:border-box;">
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Configuração da Gaveta do Kanban:</label>
                        <select id="dash-kanban-drawer" class="form-control" style="width:100%; padding:6px; box-sizing:border-box;">
                            <option value="">-- Usar Gaveta Padrão (drawerinstruments) --</option>
                            ${_allConfigs.filter(c => c.componentType === 'Drawer').map(c => 
                                `<option value="${c.configId}" ${mapping.kanbanDrawerConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Cor Primária:</label>
                        <input type="color" id="dash-primary-color" value="${styling.primaryColor || '#2c5e5a'}" style="width:60px; height:30px; padding:0; border:none; cursor:pointer;">
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Cor Hover de Destaque:</label>
                        <input type="color" id="dash-hover-color" value="${styling.hoverColor || '#1f4542'}" style="width:60px; height:30px; padding:0; border:none; cursor:pointer;">
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Cor de Acento (Accent):</label>
                        <input type="color" id="dash-accent-color" value="${styling.accentColor || '#2e7d32'}" style="width:60px; height:30px; padding:0; border:none; cursor:pointer;">
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="display:block; font-weight:bold; margin-bottom:4px;">Cor de Fundo da Tela (Canvas):</label>
                        <input type="color" id="dash-bg-canvas" value="${styling.bgCanvas || '#f1f5f9'}" style="width:60px; height:30px; padding:0; border:none; cursor:pointer;">
                    </div>
                </div>
                <div data-tab-section="menu" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3>Gerenciamento de Abas</h3>
                        <button type="button" id="dash-add-tab-btn" class="btn btn-primary" style="padding:6px 12px; font-weight:bold; font-size:12px;">+ Adicionar Aba</button>
                    </div>
                    <div id="dash-tabs-container"></div>
                </div>
            </div>
        `;

        setupTabLogic(container);
        renderTabItemsList();

        container.querySelector('#dash-add-tab-btn').onclick = () => {
            _menuItems.push({ label: 'Nova Aba', icon: 'icon-settings', type: 'viewer', targetConfigId: '', subItems: [] });
            renderTabItemsList();
        };
    }

    function setupTabLogic(container) {
        const tabs = container.querySelectorAll('.config-tab-button');
        const sections = container.querySelectorAll('[data-tab-section]');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.style.display = 'none');
                tab.classList.add('active');
                container.querySelector(`[data-tab-section="${tab.dataset.tabId}"]`).style.display = 'block';
            };
        });
    }

    function renderTabItemsList() {
        const container = _mainContainer.querySelector('#dash-tabs-container');
        if (!container) return;
        container.innerHTML = '';

        const widgetConfigs = _allConfigs.filter(c => c.componentType !== 'Dashboard' && c.componentType !== 'CardStyle');

        _menuItems.forEach((tab, idx) => {
            const item = document.createElement('div');
            item.className = 'dashboard-tab-item';
            
            const selectOptions = widgetConfigs.map(c => 
                `<option value="${c.configId}" ${tab.targetConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.componentType} - ${c.configId})</option>`
            ).join('');

            item.innerHTML = `
                <div class="dashboard-tab-header">
                    <strong style="font-size:12px; color:#475569;">Aba #${idx + 1}</strong>
                    <div class="dashboard-tab-actions">
                        <button type="button" class="dashboard-btn-icon dashboard-btn-move" data-dir="up" data-idx="${idx}" title="Mover para Cima">▲</button>
                        <button type="button" class="dashboard-btn-icon dashboard-btn-move" data-dir="down" data-idx="${idx}" title="Mover para Baixo">▼</button>
                        <button type="button" class="dashboard-btn-icon dashboard-btn-delete" data-idx="${idx}" title="Excluir Aba">✕</button>
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:8px;">
                    <div style="flex:2;">
                        <label style="display:block; font-size:10px; font-weight:bold; color:#64748b; margin-bottom:3px;">Rótulo</label>
                        <input type="text" class="tab-label-input" data-idx="${idx}" value="${tab.label || ''}" style="width:100%; padding:5px; font-size:11px; box-sizing:border-box;">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; font-size:10px; font-weight:bold; color:#64748b; margin-bottom:3px;">Ícone</label>
                        <button type="button" class="btn-pick-icon" data-idx="${idx}" style="width:100%; height:28px; padding:2px; display:flex; align-items:center; justify-content:center; gap:5px; font-size:11px; cursor:pointer; background:#fff; border:1px solid #cbd5e1; border-radius:4px;">
                            <svg class="icon" style="width:14px; height:14px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${tab.icon || 'icon-settings'}"></use></svg>
                            <span>${(tab.icon || 'icon-settings').replace('icon-', '')}</span>
                        </button>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <label style="display:block; font-size:10px; font-weight:bold; color:#64748b; margin-bottom:3px;">Tipo de Conteúdo</label>
                    <select class="tab-type-select" data-idx="${idx}" style="width:100%; padding:5px; font-size:11px; box-sizing:border-box;">
                        <option value="viewer" ${tab.type === 'viewer' ? 'selected' : ''}>Visualizador de Widget Único</option>
                        <option value="kanban" ${tab.type === 'kanban' ? 'selected' : ''}>Fluxo Kanban Nativo</option>
                        <option value="importador" ${tab.type === 'importador' ? 'selected' : ''}>Importador XML/CAL Nativo</option>
                        <option value="submenu" ${tab.type === 'submenu' ? 'selected' : ''}>Sub-Menu / Grade de Atalhos</option>
                    </select>
                </div>
                <div class="target-widget-area" style="margin-bottom:5px; ${tab.type === 'submenu' ? 'display:none;' : ''}">
                    <label style="display:block; font-size:10px; font-weight:bold; color:#64748b; margin-bottom:3px;">Widget Vinculado</label>
                    <select class="tab-widget-select" data-idx="${idx}" style="width:100%; padding:5px; font-size:11px; box-sizing:border-box;">
                        <option value="">-- Sem Widget --</option>
                        ${selectOptions}
                    </select>
                </div>
                <div class="submenu-area" style="margin-top:10px; ${tab.type === 'submenu' ? '' : 'display:none;'}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <strong style="font-size:10px; color:#475569;">Atalhos do Sub-Menu</strong>
                        <button type="button" class="btn-add-subitem" data-idx="${idx}" style="padding:2px 6px; font-size:9px; font-weight:bold;">+ Adicionar</button>
                    </div>
                    <div class="subitems-container" id="subitems-container-${idx}"></div>
                </div>
            `;

            if (tab.type === 'submenu') {
                renderSubItems(item, idx, widgetConfigs);
            }

            // Bind events
            item.querySelector('.tab-label-input').oninput = (e) => {
                _menuItems[idx].label = e.target.value;
            };
            
            item.querySelector('.btn-pick-icon').onclick = (e) => {
                const btn = e.currentTarget;
                const tabIdx = parseInt(btn.dataset.idx, 10);
                openIconPickerForTab(tabIdx, btn);
            };

            item.querySelector('.tab-type-select').onchange = (e) => {
                const newType = e.target.value;
                _menuItems[idx].type = newType;
                
                const targetWidgetArea = item.querySelector('.target-widget-area');
                const submenuArea = item.querySelector('.submenu-area');
                if (newType === 'submenu') {
                    targetWidgetArea.style.display = 'none';
                    submenuArea.style.display = 'block';
                    if (!Array.isArray(_menuItems[idx].subItems)) {
                        _menuItems[idx].subItems = [];
                    }
                    renderSubItems(item, idx, widgetConfigs);
                } else {
                    targetWidgetArea.style.display = 'block';
                    submenuArea.style.display = 'none';
                }
            };

            const widgetSelect = item.querySelector('.tab-widget-select');
            if (widgetSelect) {
                widgetSelect.onchange = (e) => {
                    _menuItems[idx].targetConfigId = e.target.value;
                };
            }

            const addSubitemBtn = item.querySelector('.btn-add-subitem');
            if (addSubitemBtn) {
                addSubitemBtn.onclick = () => {
                    if (!Array.isArray(_menuItems[idx].subItems)) _menuItems[idx].subItems = [];
                    _menuItems[idx].subItems.push({ label: 'Novo Atalho', targetConfigId: '' });
                    renderSubItems(item, idx, widgetConfigs);
                };
            }

            // Bind actions
            item.querySelector('.dashboard-btn-delete').onclick = () => {
                _menuItems.splice(idx, 1);
                renderTabItemsList();
            };

            const upBtn = item.querySelector('.dashboard-btn-move[data-dir="up"]');
            const downBtn = item.querySelector('.dashboard-btn-move[data-dir="down"]');
            
            upBtn.onclick = () => {
                if (idx > 0) {
                    const temp = _menuItems[idx];
                    _menuItems[idx] = _menuItems[idx - 1];
                    _menuItems[idx - 1] = temp;
                    renderTabItemsList();
                }
            };

            downBtn.onclick = () => {
                if (idx < _menuItems.length - 1) {
                    const temp = _menuItems[idx];
                    _menuItems[idx] = _menuItems[idx + 1];
                    _menuItems[idx + 1] = temp;
                    renderTabItemsList();
                }
            };

            container.appendChild(item);
        });
    }

    function renderSubItems(tabEl, tabIdx, widgetConfigs) {
        const container = tabEl.querySelector(`.subitems-container`);
        if (!container) return;
        container.innerHTML = '';

        const subItems = _menuItems[tabIdx].subItems || [];

        subItems.forEach((sub, subIdx) => {
            const row = document.createElement('div');
            row.className = 'subitem-row';

            const selectOptions = widgetConfigs.map(c => 
                `<option value="${c.configId}" ${sub.targetConfigId === c.configId ? 'selected' : ''}>${c.widgetTitle} (${c.configId})</option>`
            ).join('');

            row.style.display = 'flex';
            row.style.gap = '4px';
            row.style.alignItems = 'center';
            row.style.marginBottom = '4px';
            
            const iconId = sub.icon || 'icon-settings';

            row.innerHTML = `
                <button type="button" class="btn-subitem-icon" style="width:22px; height:22px; padding:2px; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #cbd5e1; border-radius:3px; cursor:pointer;" title="Escolher Ícone">
                    <svg class="icon" style="width:12px; height:12px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${iconId}"></use></svg>
                </button>
                <input type="text" class="subitem-label" value="${sub.label || ''}" placeholder="Nome do Atalho" style="flex:2; padding:3px; font-size:10px; border:1px solid #cbd5e1; border-radius:3px; min-width:0;">
                <input type="text" class="subitem-group" value="${sub.group || ''}" placeholder="Grupo (Opc. )" style="flex:1.5; padding:3px; font-size:10px; border:1px solid #cbd5e1; border-radius:3px; min-width:0;">
                <select class="subitem-select" style="flex:2; padding:3px; font-size:10px; border:1px solid #cbd5e1; border-radius:3px; min-width:0;">
                    <option value="">-- Sem Widget --</option>
                    ${selectOptions}
                </select>
                <button type="button" class="btn-del-subitem" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:bold; font-size:12px; padding:2px;">✕</button>
            `;

            row.querySelector('.btn-subitem-icon').onclick = (e) => {
                openIconPickerForTab(tabIdx, e.currentTarget, subIdx);
            };

            row.querySelector('.subitem-label').oninput = (e) => {
                subItems[subIdx].label = e.target.value;
            };

            row.querySelector('.subitem-group').oninput = (e) => {
                subItems[subIdx].group = e.target.value;
            };

            row.querySelector('.subitem-select').onchange = (e) => {
                subItems[subIdx].targetConfigId = e.target.value;
            };

            row.querySelector('.btn-del-subitem').onclick = () => {
                subItems.splice(subIdx, 1);
                renderSubItems(tabEl, tabIdx, widgetConfigs);
            };

            container.appendChild(row);
        });
    }

    function openIconPickerForTab(tabIdx, btnEl, subIdx = -1) {
        if (_iconPickerPopup) {
            _iconPickerPopup.remove();
        }

        _iconPickerPopup = document.createElement('div');
        _iconPickerPopup.className = 'icon-picker-popup';
        _iconPickerPopup.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            width: 280px;
            max-height: 250px;
            background: #fff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 6px;
            z-index: 1000000;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        _iconPickerPopup.innerHTML = `
            <style>
                .icon-picker-popup .icon-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 6px;
                    overflow-y: auto;
                    max-height: 160px;
                    padding: 3px;
                }
                .icon-picker-popup .icon-option {
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.1s, border-color 0.1s;
                }
                .icon-picker-popup .icon-option:hover {
                    background: #f1f5f9;
                    border-color: #0d6efd;
                }
                .icon-picker-popup .icon-option svg {
                    width: 18px;
                    height: 18px;
                    fill: currentColor; stroke: currentColor; stroke-width: 0.5px;
                }
                .icon-picker-popup .icon-label {
                    font-size: 8px;
                    color: #64748b;
                    margin-top: 3px;
                    text-align: center;
                    word-break: break-all;
                }
            </style>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">
                <h4 style="margin:0; font-size:11px; color:#1e293b;">Selecionar Ícone</h4>
                <input type="text" id="picker-search" placeholder="Buscar..." style="width:100px; padding:3px; font-size:10px;">
            </div>
            <div class="icon-grid">
                ${AVAILABLE_ICONS.map(id => `
                    <div class="icon-option" data-id="${id}">
                        <svg><use href="#${id}"></use></svg>
                        <span class="icon-label">${id.replace('icon-', '')}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex; justify-content:flex-end; border-top:1px solid #e2e8f0; padding-top:5px; margin-top:3px;">
                <button type="button" id="picker-cancel-btn" style="padding:2px 8px; font-size:10px; cursor:pointer;">Cancelar</button>
            </div>
        `;

        _mainContainer.appendChild(_iconPickerPopup);

        const searchInput = _iconPickerPopup.querySelector('#picker-search');
        const options = _iconPickerPopup.querySelectorAll('.icon-option');

        searchInput.focus();
        searchInput.oninput = (e) => {
            const q = e.target.value.toLowerCase();
            options.forEach(opt => {
                const id = opt.dataset.id.toLowerCase();
                opt.style.display = id.includes(q) ? 'flex' : 'none';
            });
        };

        options.forEach(opt => {
            opt.onclick = () => {
                const iconId = opt.dataset.id;
                
                if (subIdx !== -1) {
                    _menuItems[tabIdx].subItems[subIdx].icon = iconId;
                    btnEl.innerHTML = `<svg class="icon" style="width:12px; height:12px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${iconId}"></use></svg>`;
                } else {
                    _menuItems[tabIdx].icon = iconId;
                    btnEl.innerHTML = `
                        <svg class="icon" style="width:14px; height:14px; fill:currentColor; stroke:currentColor; stroke-width:0.5px;"><use href="#${iconId}"></use></svg>
                        <span>${iconId.replace('icon-', '')}</span>
                    `;
                }
                
                _iconPickerPopup.remove();
                _iconPickerPopup = null;
            };
        });

        _iconPickerPopup.querySelector('#picker-cancel-btn').onclick = () => {
            _iconPickerPopup.remove();
            _iconPickerPopup = null;
        };
    }

    function read(container) {
        const styling = {
            title: container.querySelector('#dash-title').value,
            version: container.querySelector('#dash-version').value,
            primaryColor: container.querySelector('#dash-primary-color').value,
            hoverColor: container.querySelector('#dash-hover-color').value,
            accentColor: container.querySelector('#dash-accent-color').value,
            bgCanvas: container.querySelector('#dash-bg-canvas').value
        };

        const mapping = {
            menuItems: _menuItems,
            kanbanDrawerConfigId: container.querySelector('#dash-kanban-drawer').value || ''
        };

        return { mapping, styling, actions: {} };
    }

    return { render, read };
})();
window.DashboardConfigEditor = DashboardConfigEditor;
