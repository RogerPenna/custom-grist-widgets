// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

let modalOverlay, modalContent, modalTitle, modalBody, saveButton;
let currentOnSave, currentOnCancel;
let currentSchema = {}; 
let currentRequiredFields = [];

// Motores dinâmicos
let activeTableLens;
let activeDataWriter;

function _ensureTools() {
    if (!activeTableLens) {
        try { activeTableLens = new GristTableLens(window.grist); } catch (e) { console.warn("[Modal] TableLens not ready"); }
    }
    if (!activeDataWriter) {
        try { activeDataWriter = new GristDataWriter(window.grist); } catch (e) { console.warn("[Modal] DataWriter not ready"); }
    }
}

function _initializeModalDOM() {
    if (document.getElementById('grist-modal-overlay')) return;
    _ensureTools();
    
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'grist-modal-overlay';
    modalOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:2147483647;display:none;align-items:center;justify-content:center;font-family:'Manrope',sans-serif;";
    
    modalOverlay.innerHTML = `
        <div id="grist-modal-content" style="background:white;width:500px;max-height:90vh;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding:20px;border-bottom:1px solid #eee;"><h2 id="modal-title" style="margin:0;font-size:18px;"></h2></div>
            <div class="modal-body" style="padding:20px;flex:1;overflow-y:auto;"></div>
            <div class="modal-footer" style="padding:15px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;background:#fcfcfc;">
                <button id="modal-cancel-btn" style="padding:8px 16px;border-radius:4px;border:1px solid #ddd;background:white;color:#666;cursor:pointer;">Cancelar</button>
                <button id="modal-save-btn" style="padding:8px 16px;border-radius:4px;border:none;background:#28a745;color:white;cursor:pointer;font-weight:bold;">Salvar</button>
            </div>
        </div>`;
    
    document.body.appendChild(modalOverlay);
    modalContent = document.getElementById('grist-modal-content');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.querySelector('.modal-body');
    saveButton = document.getElementById('modal-save-btn');
    
    modalContent.addEventListener('click', e => e.stopPropagation());
    modalOverlay.addEventListener('click', () => closeModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => closeModal());
    saveButton.addEventListener('click', _handleSave);
}

async function _handleSave() {
    const changes = {};
    const formElements = modalBody.querySelectorAll('input[data-col-id], select[data-col-id], textarea[data-col-id]');
    
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
        } else if (colSchema.type.startsWith('Ref:')) {
            value = el.value ? Number(el.value) : 0;
        } else if (colSchema.type === 'Numeric' || colSchema.type === 'Int') {
            value = el.value !== '' ? Number(el.value) : null;
        } else {
            value = el.value;
        }
        changes[colId] = value;
    });

    if (currentOnSave) {
        try {
            await currentOnSave(changes);
            closeModal();
        } catch (err) {
            alert("Erro ao salvar: " + err.message);
        }
    }
}

export function openModal(options) {
    _initializeModalDOM();
    const { title, record, schema, onSave, onCancel, hiddenFields = [], lockedFields = [], requiredFields = [], tableLens } = options;
    
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    currentSchema = schema;
    
    // Injeção de motor para o Modal
    activeTableLens = tableLens || new GristTableLens(window.grist);
    
    modalBody.innerHTML = '';
    
    Object.values(schema)
        .filter(col => col && !col.isFormula && !col.colId.startsWith('gristHelper_') && !hiddenFields.includes(col.colId))
        .forEach(col => {
            const row = document.createElement('div');
            row.style.marginBottom = '15px';
            row.innerHTML = `<label style="display:block;font-weight:bold;font-size:12px;color:#666;margin-bottom:5px;">${col.label || col.colId}</label><div class="val"></div>`;
            modalBody.appendChild(row);
            
            renderField({
                container: row.querySelector('.val'),
                colSchema: col,
                record: record,
                isEditing: true,
                tableLens: activeTableLens
            });
        });

    modalOverlay.style.display = 'flex';
}

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    if (modalOverlay) modalOverlay.style.display = 'none';
}
