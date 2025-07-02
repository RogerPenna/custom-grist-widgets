// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let modalOverlay, modalContent, modalTitle, modalBody, modalFooter;
let currentOnSave, currentOnCancel;

function _initializeModalDOM() {
    if (document.getElementById('grist-modal-overlay')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-modal-component/modal-style.css';
    document.head.appendChild(link);

    modalOverlay = document.createElement('div');
    modalOverlay.id = 'grist-modal-overlay';
    modalOverlay.innerHTML = `
        <div id="grist-modal-content">
            <div class="modal-header"><h2 id="modal-title"></h2></div>
            <div class="modal-body"></div>
            <div class="modal-footer">
                <button id="modal-cancel-btn" class="btn-secondary">Cancelar</button>
                <button id="modal-save-btn" class="btn-primary">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);
    modalContent = document.getElementById('grist-modal-content');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.querySelector('.modal-body');
    modalFooter = document.querySelector('.modal-footer');
    
    modalContent.addEventListener('click', e => e.stopPropagation());
    modalOverlay.addEventListener('click', () => closeModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => closeModal());
    document.getElementById('modal-save-btn').addEventListener('click', () => _handleSave());
}

async function _handleSave() {
    const changes = {};
    const formElements = modalBody.querySelectorAll('[data-col-id]');
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        // Logic to get value from different input types
        if (el.type === 'checkbox') {
            changes[colId] = el.checked;
        } else {
            changes[colId] = el.value;
        }
    });

    if (currentOnSave) {
        await currentOnSave(changes);
    }
    closeModal();
}

export function openModal(options) {
    const { title, tableId, record, schema, onSave, onCancel } = options;
    _initializeModalDOM();
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    modalBody.innerHTML = '';
    
    const ruleIdToColIdMap = new Map();
    schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

    schema.filter(col => !col.colId.startsWith('gristHelper_')).forEach(colSchema => {
        const isEditable = !colSchema.isFormula;

        const row = document.createElement('div');
        row.className = 'modal-field-row';
        const label = document.createElement('label');
        label.className = 'modal-field-label';
        label.textContent = colSchema.label || colSchema.colId;
        
        // The container that the field-renderer will populate with an input.
        const valueContainer = document.createElement('div');
        
        row.appendChild(label);
        row.appendChild(valueContainer);
        modalBody.appendChild(row);

        renderField({
            container: valueContainer,
            colSchema,
            record,
            tableLens,
            ruleIdToColIdMap,
            isEditing // Pass the new editing flag!
        });
    });
    modalOverlay.classList.add('is-open');
}

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    modalOverlay.classList.remove('is-open');
    currentOnSave = null;
    currentOnCancel = null;
}