// libraries/grist-config-manager/editors/config-bsc.js

export const BscConfigEditor = (() => {
    let state = {};
    let _mainContainer = null;

    function updateDebugJson() {
        if (!_mainContainer) return;
        const outputEl = _mainContainer.querySelector('#config-json-output');
        if (!outputEl) return;
        try {
            const config = read(_mainContainer);
            outputEl.innerHTML = `
                <div class="debug-tri-section">
                    <div class="debug-label mapping">mappingJson (O "Onde")</div>
                    <pre><code>${JSON.stringify(config.mapping, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label styling">stylingJson (O "Como")</div>
                    <pre><code>${JSON.stringify(config.styling, null, 2)}</code></pre>
                </div>
                <div class="debug-tri-section">
                    <div class="debug-label actions">actionsJson (O "O que faz")</div>
                    <pre><code>${JSON.stringify(config.actions, null, 2)}</code></pre>
                </div>
            `;
        } catch (e) {
            outputEl.textContent = "Erro ao ler a configuração: " + e.message;
        }
    }

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        _mainContainer = container;
        const options = config || {};
        state = {
            useColoris: options.useColoris || false,
            drawerConfigId: options.drawerConfigId || null,
            perspectivesConfigId: options.perspectivesConfigId || null, // Default / Mapa Estratégico
            qualityConfigId: options.qualityConfigId || null, // New: Objetivos Qualidade
            requirementsConfigId: options.requirementsConfigId || null, // New: Requisitos Partes Interessadas
            receivedConfigs: receivedConfigs
        };

        container.innerHTML = `
            <style>
                .debug-tri-section { margin-bottom: 15px; border-left: 4px solid #ddd; padding-left: 10px; }
                .debug-label { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
                .debug-label.mapping { color: #0d6efd; }
                .debug-label.styling { color: #198754; }
                .debug-label.actions { color: #fd7e14; }
                .config-debugger pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; max-height: 200px; overflow: auto; }
            </style>
        `;

        // Create Tabs
        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [
            createTabButton("General", "gen", container),
            createTabButton("Display", "cols", container), // Renamed from Columns
            createTabButton("Actions", "act", container)
        ].forEach(t => tabsRow.appendChild(t));
        container.appendChild(tabsRow);

        const debugSection = document.createElement("div");
        debugSection.innerHTML = `
            <details class="config-debugger">
                <summary>Ver Tripartição JSON (Debug)</summary>
                <div id="config-json-output"></div>
            </details>`;
        container.appendChild(debugSection);

        // Content Area
        const contentArea = document.createElement("div");
        contentArea.className = 'config-content';
        contentArea.id = "bsc-config-contents";
        container.appendChild(contentArea);

        // Build Tabs
        buildGeneralTab(contentArea);
        buildColumnsTab(contentArea);
        buildActionsTab(contentArea);

        // Initialize
        switchTab("act", container); // Default to Actions as it's the main feature for now

        container.addEventListener('change', updateDebugJson);
        container.addEventListener('input', updateDebugJson);
        updateDebugJson();
    }

    function read(container) {
        const genTab = container.querySelector("[data-tab-section='gen']");
        const colsTab = container.querySelector("[data-tab-section='cols']");
        const actTab = container.querySelector("[data-tab-section='act']");

        const fullConfig = {
            useColoris: genTab ? genTab.querySelector('#bsc-cfg-use-coloris').checked : state.useColoris,
            drawerConfigId: actTab ? actTab.querySelector('#bsc-cfg-drawer-id').value : state.drawerConfigId,
            perspectivesConfigId: colsTab ? colsTab.querySelector('#bsc-cfg-persp-card-id').value : state.perspectivesConfigId,
            qualityConfigId: colsTab ? colsTab.querySelector('#bsc-cfg-quality-card-id').value : state.qualityConfigId,
            requirementsConfigId: colsTab ? colsTab.querySelector('#bsc-cfg-req-card-id').value : state.requirementsConfigId
        };

        // --- TRIPARTIÇÃO ---
        const mapping = {
            perspectivesConfigId: fullConfig.perspectivesConfigId,
            qualityConfigId: fullConfig.qualityConfigId,
            requirementsConfigId: fullConfig.requirementsConfigId
        };

        const styling = {
            useColoris: fullConfig.useColoris
        };

        const actions = {
            drawerConfigId: fullConfig.drawerConfigId
        };

        return { mapping, styling, actions };
    }

    // --- Tab Helpers ---

    function createTabButton(label, tabId, container) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.className = 'config-tab-button';
        btn.addEventListener("click", () => switchTab(tabId, container));
        btn.dataset.tabId = tabId;
        return btn;
    }

    function switchTab(tabId, container) {
        const contentDiv = container.querySelector("#bsc-config-contents");
        if (!contentDiv) return;

        contentDiv.querySelectorAll("[data-tab-section]").forEach(t => (t.style.display = "none"));
        container.querySelectorAll("[data-tab-id]").forEach(b => b.classList.remove('active'));

        const newActiveTab = contentDiv.querySelector(`[data-tab-section='${tabId}']`);
        if (newActiveTab) newActiveTab.style.display = "block";

        const activeBtn = container.querySelector(`[data-tab-id='${tabId}']`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // --- Tab Builders ---

    function buildGeneralTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "gen";
        tabEl.style.display = "none";
        tabEl.innerHTML = `
            <h3>General Settings</h3>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="bsc-cfg-use-coloris" ${state.useColoris ? 'checked' : ''}>
                    Use Coloris library (Legacy)
                </label>
                <p class="help-text">
                    Use the legacy Coloris library for color picking instead of the native browser picker.
                </p>
            </div>
            <div class="placeholder-notice">
                <p>More general settings will be available here.</p>
            </div>
        `;
        container.appendChild(tabEl);
    }

    function buildColumnsTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "cols";
        tabEl.style.display = "none";

        // Filter for Card System configs
        const cardConfigs = state.receivedConfigs.filter(c => c.componentType === 'Card System');
        
        const createOptions = (selectedId) => cardConfigs.map(c =>
            `<option value="${c.configId}" ${c.configId === selectedId ? 'selected' : ''}>
                ${c.widgetTitle} (${c.configId})
            </option>`
        ).join('');

        tabEl.innerHTML = `
            <h3>Display Settings</h3>
            <fieldset>
                <legend><b>Map Display Configuration (by Model Type)</b></legend>
                
                <div class="form-group">
                    <label for="bsc-cfg-persp-card-id">Mapa Estratégico:</label>
                    <select id="bsc-cfg-persp-card-id" class="form-control">
                        <option value="">-- Default --</option>
                        ${createOptions(state.perspectivesConfigId)}
                    </select>
                    <p class="help-text">Controls rendering for "Mapa Estratégico".</p>
                </div>

                <div class="form-group">
                    <label for="bsc-cfg-quality-card-id">Objetivos Qualidade:</label>
                    <select id="bsc-cfg-quality-card-id" class="form-control">
                        <option value="">-- Same as Default --</option>
                        ${createOptions(state.qualityConfigId)}
                    </select>
                    <p class="help-text">Controls rendering for "Objetivos Qualidade".</p>
                </div>

                <div class="form-group">
                    <label for="bsc-cfg-req-card-id">Requisitos Partes Interessadas:</label>
                    <select id="bsc-cfg-req-card-id" class="form-control">
                        <option value="">-- Same as Default --</option>
                        ${createOptions(state.requirementsConfigId)}
                    </select>
                    <p class="help-text">Controls rendering for "Requisitos Partes Interessadas".</p>
                </div>
            </fieldset>
        `;
        container.appendChild(tabEl);
    }

    function buildActionsTab(container) {
        const tabEl = document.createElement("div");
        tabEl.dataset.tabSection = "act";
        tabEl.style.display = "none";

        // Filter for Drawer configs
        const drawerConfigs = state.receivedConfigs.filter(c => c.componentType === 'Drawer');
        const optionsHtml = drawerConfigs.map(c =>
            `<option value="${c.configId}" ${c.configId === state.drawerConfigId ? 'selected' : ''}>
                ${c.widgetTitle} (${c.configId})
            </option>`
        ).join('');

        tabEl.innerHTML = `
            <h3>Actions Configuration</h3>
            <fieldset>
                <legend><b>Card Click Action</b></legend>
                <div class="form-group">
                    <label for="bsc-cfg-drawer-id">Open Drawer Configuration:</label>
                    <select id="bsc-cfg-drawer-id" class="form-control">
                        <option value="">-- Default / None --</option>
                        ${optionsHtml}
                    </select>
                    <p class="help-text">
                        Select a Drawer Configuration to open when a card is clicked. 
                        If none is selected, the default perspective editor will be used.
                    </p>
                </div>
            </fieldset>
        `;
        container.appendChild(tabEl);
    }

    return {
        render,
        read
    };
})();
