// libraries/grist-config-manager/editors/config-bsc.js

export const BscConfigEditor = (() => {
    let state = {};

    function render(container, config, tableLens, tableId, receivedConfigs = []) {
        const options = config || {};
        state = {
            useColoris: options.useColoris || false,
            drawerConfigId: options.drawerConfigId || null,
            perspectivesConfigId: options.perspectivesConfigId || null, // New: Perspectives Card Config
            receivedConfigs: receivedConfigs
        };

        container.innerHTML = "";

        // Create Tabs
        const tabsRow = document.createElement("div");
        tabsRow.className = 'config-tabs';
        [
            createTabButton("General", "gen", container),
            createTabButton("Display", "cols", container), // Renamed from Columns
            createTabButton("Actions", "act", container)
        ].forEach(t => tabsRow.appendChild(t));
        container.appendChild(tabsRow);

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
    }

    function read(container) {
        const genTab = container.querySelector("[data-tab-section='gen']");
        const colsTab = container.querySelector("[data-tab-section='cols']"); // Changed from placeholder to use
        const actTab = container.querySelector("[data-tab-section='act']");

        return {
            useColoris: genTab ? genTab.querySelector('#bsc-cfg-use-coloris').checked : state.useColoris,
            drawerConfigId: actTab ? actTab.querySelector('#bsc-cfg-drawer-id').value : state.drawerConfigId,
            perspectivesConfigId: colsTab ? colsTab.querySelector('#bsc-cfg-persp-card-id').value : state.perspectivesConfigId
        };
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
        const optionsHtml = cardConfigs.map(c =>
            `<option value="${c.configId}" ${c.configId === state.perspectivesConfigId ? 'selected' : ''}>
                ${c.widgetTitle} (${c.configId})
            </option>`
        ).join('');

        tabEl.innerHTML = `
            <h3>Display Settings</h3>
            <fieldset>
                <legend><b>Map Display</b></legend>
                <div class="form-group">
                    <label for="bsc-cfg-persp-card-id">Perspectives Card Configuration:</label>
                    <select id="bsc-cfg-persp-card-id" class="form-control">
                        <option value="">-- Default (Simple List) --</option>
                        ${optionsHtml}
                    </select>
                    <p class="help-text">
                        Select a "Card System" configuration to control how Perspectives are rendered in the BSC Map.
                        The Objectives inside them should be configured within that Card configuration.
                    </p>
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
