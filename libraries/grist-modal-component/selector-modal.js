// libraries/grist-modal-component/selector-modal.js

let selectorModalOverlay;
let selectorModalContent;

function _initializeSelectorModalDOM() {
    if (document.getElementById('grist-selector-modal-overlay')) return;
    
    selectorModalOverlay = document.createElement('div');
    selectorModalOverlay.id = 'grist-selector-modal-overlay';
    selectorModalOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2147483648;display:none;align-items:center;justify-content:center;font-family:'Manrope',sans-serif;";
    
    selectorModalOverlay.innerHTML = `
        <div id="grist-selector-modal-content" style="background:white;width:600px;max-height:90vh;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding:20px;border-bottom:1px solid #eee;">
                <h2 id="selector-modal-title" style="margin:0 0 15px 0;font-size:18px;"></h2>
                <div style="position:relative;">
                    <input type="text" id="selector-modal-search" placeholder="Pesquisar..." style="width:100%;padding:10px 15px 10px 35px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#64748b" stroke-width="2" fill="none" style="position:absolute;left:10px;top:12px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
            </div>
            <div class="modal-body" id="selector-modal-list" style="padding:10px;flex:1;overflow-y:auto;background:#f8fafc;display:flex;flex-direction:column;gap:5px;"></div>
            <div class="modal-footer" style="padding:15px 20px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;background:#fcfcfc;">
                <div style="font-size:13px;color:#64748b;"><span id="selector-modal-count">0</span> selecionados</div>
                <div style="display:flex;gap:10px;">
                    <button id="selector-modal-cancel-btn" style="padding:8px 16px;border-radius:4px;border:1px solid #ddd;background:white;color:#666;cursor:pointer;">Cancelar</button>
                    <button id="selector-modal-save-btn" style="padding:8px 16px;border-radius:4px;border:none;background:#2563eb;color:white;cursor:pointer;font-weight:bold;">Adicionar</button>
                </div>
            </div>
        </div>`;
    
    document.body.appendChild(selectorModalOverlay);
    selectorModalContent = document.getElementById('grist-selector-modal-content');
    
    selectorModalContent.addEventListener('click', e => e.stopPropagation());
}

export function openSelectorModal(options) {
    _initializeSelectorModalDOM();
    const { title, items, renderItem, searchFn, onSave, onCancel } = options;
    
    document.getElementById('selector-modal-title').textContent = title || "Selecionar Itens";
    const searchInput = document.getElementById('selector-modal-search');
    const listContainer = document.getElementById('selector-modal-list');
    const countDisplay = document.getElementById('selector-modal-count');
    const saveBtn = document.getElementById('selector-modal-save-btn');
    const cancelBtn = document.getElementById('selector-modal-cancel-btn');
    
    searchInput.value = '';
    
    let selectedIds = new Set();
    
    function updateCount() {
        countDisplay.textContent = selectedIds.size;
    }
    
    function renderList(query = '') {
        listContainer.innerHTML = '';
        
        const filtered = items.filter(item => {
            if (!query) return true;
            return searchFn(item, query.toLowerCase());
        });
        
        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhum item encontrado.</div>';
            return;
        }
        
        filtered.forEach(item => {
            const row = document.createElement('label');
            const bg = typeof options.getRowBackground === 'function' ? (options.getRowBackground(item) || 'white') : 'white';
            row.style.cssText = `display:flex;align-items:center;gap:10px;padding:12px;background:${bg};border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;transition:all 0.2s;`;
            row.onmouseenter = () => row.style.borderColor = '#cbd5e1';
            row.onmouseleave = () => row.style.borderColor = '#e2e8f0';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedIds.has(item.id);
            checkbox.style.cssText = "width:16px;height:16px;cursor:pointer;";
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) selectedIds.add(item.id);
                else selectedIds.delete(item.id);
                updateCount();
            });
            
            const content = document.createElement('div');
            content.style.flex = "1";
            content.style.fontSize = "14px";
            content.style.color = "#334155";
            
            if (typeof renderItem === 'function') {
                const res = renderItem(item);
                if (typeof res === 'string') content.innerHTML = res;
                else content.appendChild(res);
            } else {
                content.textContent = String(item.id);
            }
            
            row.appendChild(checkbox);
            row.appendChild(content);
            listContainer.appendChild(row);
        });
    }
    
    searchInput.oninput = (e) => renderList(e.target.value);
    
    const closeFn = () => {
        selectorModalOverlay.style.display = 'none';
        if (onCancel) onCancel();
    };
    
    selectorModalOverlay.onclick = closeFn;
    cancelBtn.onclick = closeFn;
    
    saveBtn.onclick = () => {
        selectorModalOverlay.style.display = 'none';
        if (onSave) onSave(Array.from(selectedIds));
    };
    
    renderList();
    updateCount();
    selectorModalOverlay.style.display = 'flex';
    searchInput.focus();
}
