// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus.js'; // Import the publish function

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let modalOverlay, modalContent, modalTitle, modalBody;
let currentOnSave, currentOnCancel;
let currentContext = {}; // To store tableId, recordId etc.

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
    
    modalContent.addEventListener('click', e => e.stopPropagation());
    modalOverlay.addEventListener('click', () => closeModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => closeModal());
    document.getElementById('modal-save-btn').addEventListener('click', () => _handleSave());
}

async function _handleSave() {
    const changes = {};
    modalBody.querySelectorAll('[data-col-id]').forEach(el => {
        const colId = el.dataset.colId;
        changes[colId] = (el.type === 'checkbox') ? el.checked : el.value;
    });

    if (currentOnSave) {
        try {
            // Let the caller do the writing and tell us what happened
            const { action, tableId, recordId } = await currentOnSave(changes);
            
            // Publish a generic event that other components can listen to.
            publish('data-changed', { action, tableId, recordId });

        } catch (err) {
            console.error("Modal onSave callback failed:", err);
            // Optionally show an error message to the user
        }
    }
    closeModal();
}

/**
 * @param {object} options
 * @param {string} options.title - The title of the modal.
 * @param {string} options.tableId - The table ID for the record.
 * @param {object} options.record - The record object. Empty {} for "add" mode.
 * @param {object[]} options.schema - The raw schema for the table.
 * @param {function} options.onSave - Async function that receives changes and performs the write action.
 * @param {function} [options.onCancel] - Optional callback for cancel.
 */
export function openModal(options) {
    _initializeModalDOM();
    const { title, tableId, record, schema, onSave, onCancel } = options;
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    modalBody.innerHTML = '';
    
    const ruleIdToColIdMap = new Map();
    schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

    // FIX: Show all non-formula fields, including ChoiceList
    schema.filter(col => !col.isFormula && !col.colId.startsWith('gristHelper_'))
        .forEach(colSchema => {
        const row = document.createElement('div'); row.className = 'modal-field-row';
        const label = document.createElement('label'); label.className = 'modal-field-label';
        label.textContent = colSchema.label || colSchema.colId;
        const valueContainer = document.createElement('div');
        row.appendChild(label); row.appendChild(valueContainer);
        modalBody.appendChild(row);

        // Call the same renderer, but always in edit mode
        renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap, isEditing: true });
    });
    modalOverlay.classList.add('is-open');

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    modalOverlay.classList.remove('is-open');
    currentOnSave = null;
    currentOnCancel = null;
}