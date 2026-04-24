// libraries/grist-launcher-utils.js

export const GristLauncherUtils = (() => {
    
    function getIcon(id) {
        return `<svg class="icon" style="width:20px; height:20px;"><use href="#${id}"></use></svg>`;
    }

    /**
     * Renders a standardized settings popover with a dropdown for config selection.
     * Agnostic to component type to allow flexible linking.
     */
    async function renderSettingsPopover(options) {
        const {
            grist,
            tableLens,
            currentConfigId,
            currentConfig,
            onLink,        
            onOpenManager  
        } = options;

        const activeConfigId = currentConfigId || '';
        const isLinked = !!activeConfigId && !!currentConfig;

        // Fetch all available configs to show in dropdown
        let configOptionsHtml = '<option value="">-- Selecionar Config Existente --</option>';
        try {
            const allConfigs = await tableLens.fetchTableRecords('Grf_config');
            
            // Agrupar por tipo para melhor organização no dropdown
            const groups = {};
            allConfigs.forEach(c => {
                const type = c.componentType || 'Outros';
                if (!groups[type]) groups[type] = [];
                groups[type].push(c);
            });

            // Ordenar tipos alfabeticamente
            const sortedTypes = Object.keys(groups).sort();

            for (const type of sortedTypes) {
                configOptionsHtml += `<optgroup label="${type}">`;
                configOptionsHtml += groups[type].map(c => {
                    const unified = tableLens.parseConfigRecord(c);
                    const tableDisplay = unified.tableId ? ` (${unified.tableId})` : '';
                    return `<option value="${c.configId}" ${c.configId === activeConfigId ? 'selected' : ''}>${c.widgetTitle}${tableDisplay} [${c.configId}]</option>`;
                }).join('');
                configOptionsHtml += `</optgroup>`;
            }
        } catch (e) {
            console.warn("Could not fetch configs for dropdown", e);
        }

        const overlay = document.createElement('div');
        overlay.id = 'config-popover-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:1000000;";
        overlay.onclick = () => {
            popover.remove();
            overlay.remove();
        };
        document.body.appendChild(overlay);

        const popover = document.createElement('div');
        popover.className = 'config-popover';
        popover.style.cssText = "position:fixed; top:50px; right:20px; background:white; padding:15px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:1000001; min-width:300px; font-family:sans-serif;";
        popover.onclick = e => e.stopPropagation();

        popover.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="display:block; font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; margin-bottom:8px;">Vincular Configuração</label>
                <div style="margin-bottom: 10px;">
                    <select id="popover-config-id-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        ${configOptionsHtml}
                    </select>
                </div>
                <div style="font-size: 10px; color: #666; margin-bottom: 5px;">Ou cole o ID manualmente:</div>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="popover-config-id" value="${activeConfigId}" placeholder="Cole o ID aqui..." style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:12px;">
                    <button id="popover-link-btn" style="background:none; border:1px solid #ddd; border-radius:4px; padding:4px 8px; cursor:pointer;" title="${isLinked ? 'Desvincular' : 'Vincular'}">
                        ${isLinked ? getIcon('icon-link') : getIcon('icon-link-broken')}
                    </button>
                </div>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 10px; display:flex; justify-content:flex-end;">
                <button id="popover-manager-btn" style="background:none; border:none; cursor:pointer; color:#64748b;" title="Abrir Gerenciador de Configurações">
                    ${getIcon('icon-settings')}
                </button>
            </div>
        `;
        document.body.appendChild(popover);

        const selectEl = popover.querySelector('#popover-config-id-select');
        const inputEl = popover.querySelector('#popover-config-id');

        selectEl.onchange = () => {
            if (selectEl.value) inputEl.value = selectEl.value;
        };

        popover.querySelector('#popover-link-btn').onclick = async () => {
            const newId = inputEl.value.trim();
            if (onLink) await onLink(newId);
            popover.remove();
            overlay.remove();
        };

        popover.querySelector('#popover-manager-btn').onclick = () => {
            if (onOpenManager) onOpenManager();
            popover.remove();
            overlay.remove();
        };
    }

    return {
        renderSettingsPopover
    };

})();
