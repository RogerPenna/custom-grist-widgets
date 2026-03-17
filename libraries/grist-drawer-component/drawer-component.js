// libraries/grist-drawer-component/drawer-component.js
// VERSÃO CLÁSSICA PURA (SEM IMPORTS) PARA COMPATIBILIDADE TOTAL

(function() {
    console.log("Drawer Component: Script carregado com sucesso.");

    let drawerPanel, drawerOverlay, drawerTitle, drawerContent;
    let currentTableId, currentRecordId, currentSchema, currentRecord;
    let activeTableLens;

    function log(msg) {
        console.log(`[Drawer] ${msg}`);
        const debugEl = document.getElementById('debug-log');
        if (debugEl) {
            const entry = document.createElement('div');
            entry.textContent = `[${new Date().toLocaleTimeString()}] [Drawer] ${msg}`;
            debugEl.appendChild(entry);
            debugEl.scrollTop = debugEl.scrollHeight;
        }
    }

    function _initializeDOM() {
        if (document.getElementById('grf-drawer-panel')) return;
        log("Iniciando interface...");
        
        drawerOverlay = document.createElement('div');
        drawerOverlay.id = 'grf-drawer-overlay';
        drawerOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9998;display:none;backdrop-filter:blur(2px);";
        
        drawerPanel = document.createElement('div');
        drawerPanel.id = 'grf-drawer-panel';
        drawerPanel.style.cssText = "position:fixed;top:0;right:-600px;width:600px;height:100%;background:white;z-index:9999;transition:right 0.3s ease-out;box-shadow:-5px 0 25px rgba(0,0,0,0.15);display:flex;flex-direction:column;font-family:'Manrope',sans-serif;";
        
        drawerPanel.innerHTML = `
            <div class="drawer-header" style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                <h2 id="grf-drawer-title" style="margin:0;font-size:18px;font-weight:800;color:#1e293b;"></h2>
                <div style="display:flex;gap:10px;">
                    <button id="grf-drawer-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">&times;</button>
                </div>
            </div>
            <div id="grf-drawer-body" style="flex:1;overflow-y:auto;padding:20px;"></div>`;

        document.body.appendChild(drawerOverlay);
        document.body.appendChild(drawerPanel);
        
        drawerTitle = document.getElementById('grf-drawer-title');
        drawerContent = document.getElementById('grf-drawer-body');
        
        document.getElementById('grf-drawer-close-btn').onclick = () => window.GristDrawer.close();
        drawerOverlay.onclick = () => window.GristDrawer.close();
    }

    async function _render() {
        log("Buscando dados...");
        drawerContent.innerHTML = 'Carregando detalhes...';
        try {
            const [schema, record] = await Promise.all([
                activeTableLens.getTableSchema(currentTableId),
                activeTableLens.fetchRecordById(currentTableId, currentRecordId)
            ]);
            
            currentSchema = schema;
            drawerContent.innerHTML = '';
            
            Object.values(schema).forEach(col => {
                if (col.colId.startsWith('gristHelper_')) return;
                const row = document.createElement('div');
                row.style.marginBottom = '15px';
                row.innerHTML = `<label style="font-weight:800;font-size:11px;color:#888;display:block;margin-bottom:4px;text-transform:uppercase;">${col.label || col.colId}</label><div class="val" style="color:#333;font-size:14px;min-height:18px;"></div>`;
                drawerContent.appendChild(row);
                
                const container = row.querySelector('.val');
                // Se o renderer global estiver pronto, usa ele. Senão, fallback para texto simples.
                if (window.GristRenderer && typeof window.GristRenderer.renderField === 'function') {
                    window.GristRenderer.renderField({
                        container: container,
                        colSchema: col,
                        record: record,
                        tableLens: activeTableLens
                    });
                } else {
                    container.textContent = String(record[col.colId] ?? '');
                }
            });
            log("Renderização concluída.");
        } catch (e) { log(`Erro render: ${e.message}`); }
    }

    // EXPOSIÇÃO GLOBAL DEFINITIVA
    window.GristDrawer = {
        open: async function(tableId, recordId, options = {}) {
            _initializeDOM();
            log(`Abrindo ${tableId} ID ${recordId}`);
            
            currentTableId = tableId;
            currentRecordId = recordId;
            activeTableLens = options.tableLens; // Recebe o motor do chamador (Cards ou Tabela)

            drawerTitle.textContent = `Registro #${recordId}`;
            drawerPanel.style.right = '0';
            drawerOverlay.style.display = 'block';
            await _render();
        },
        close: function() {
            if (!drawerPanel) return;
            drawerPanel.style.right = '-600px';
            drawerOverlay.style.display = 'none';
        }
    };
})();
