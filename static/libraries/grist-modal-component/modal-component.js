// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let modalOverlay, modalContent, modalTitle, modalBody, saveButton;
let currentOnSave, currentOnCancel;
let currentSchema = {}; 
let currentRequiredFields = [];

function _initializeModalDOM() {
    if (document.getElementById('grist-modal-overlay')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../libraries/grist-modal-component/modal-style.css'; document.head.appendChild(link);
    const style = document.createElement('style'); style.id = 'grf-modal-component-styles'; style.textContent = `.required-indicator { color: #dc3545; font-weight: bold; margin-left: 4px; }`; document.head.appendChild(style);
    modalOverlay = document.createElement('div'); modalOverlay.id = 'grist-modal-overlay';
    modalOverlay.innerHTML = `<div id="grist-modal-content"><div class="modal-header"><h2 id="modal-title"></h2></div><div class="modal-body"></div><div class="modal-footer"><button id="modal-cancel-btn" class="btn-secondary">Cancelar</button><button id="modal-save-btn" class="btn-primary">Salvar</button></div></div>`;
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

// --- INÍCIO DAS NOVAS FUNÇÕES DE VALIDAÇÃO ---

function _isModalFieldEmpty(element, colSchema) {
    if (!element) return true;
    const type = colSchema.type || 'Any';
    let value;
    if (element.type === 'checkbox') { value = element.checked; } 
    else if (element.tagName === 'SELECT' && element.multiple) { value = Array.from(element.selectedOptions).map(opt => opt.value); } 
    else { value = element.value; }

    if (type === 'Bool') return value !== true;
    if (type === 'ChoiceList' || type.startsWith('RefList')) return !value || value.length === 0;
    return !value || String(value).trim() === '';
}

function _validateModalForm() {
    if (currentRequiredFields.length === 0) {
        saveButton.disabled = false;
        return;
    }
    let isFormValid = true;
    for (const colId of currentRequiredFields) {
        const fieldElement = modalBody.querySelector(`[data-col-id="${colId}"]`);
        const colSchema = currentSchema[colId];
        if (colSchema && _isModalFieldEmpty(fieldElement, colSchema)) {
            isFormValid = false;
            break;
        }
    }
    saveButton.disabled = !isFormValid;
    saveButton.title = isFormValid ? 'Salvar' : 'Preencha todos os campos obrigatórios (*).';
}

function _addModalFormListeners() {
    const formElements = modalBody.querySelectorAll('[data-col-id]');
    formElements.forEach(el => {
        el.addEventListener('change', _validateModalForm);
        el.addEventListener('keyup', _validateModalForm);
        el.addEventListener('input', _validateModalForm);
    });
}
// --- FIM DAS NOVAS FUNÇÕES DE VALIDAÇÃO ---


async function _handleSave() {
    const changes = {};
    const formElements = modalBody.querySelectorAll('[data-col-id]');
    formElements.forEach(el => { /* ... lógica de coleta de dados inalterada ... */ });
    if (currentOnSave) { try { await currentOnSave(changes); closeModal(); } catch (err) { console.error("Modal onSave failed:", err); alert("ERRO AO SALVAR: " + err.message); } }
}

export function openModal(options) {
    _initializeModalDOM();
    const { title, record, schema, onSave, onCancel, hiddenFields = [], lockedFields = [], requiredFields = [] } = options;
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    currentSchema = schema;
    currentRequiredFields = requiredFields; // Armazena os campos obrigatórios
    modalBody.innerHTML = '';
    
    const schemaAsArray = Object.values(schema);
    const ruleIdToColIdMap = new Map();
    schemaAsArray.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.id); } });

    schemaAsArray
        .filter(col => col && !col.isFormula && !col.colId.startsWith('gristHelper_') && col.type !== 'ManualSortPos' && !hiddenFields.includes(col.colId))
        .forEach(colSchema => {
            const row = document.createElement('div'); row.className = 'modal-field-row';
            const label = document.createElement('label'); label.className = 'modal-field-label';
            const labelText = colSchema.label || colSchema.colId;
            const isFieldRequired = requiredFields.includes(colSchema.colId);
            let labelHtml = labelText;
            if (isFieldRequired) { labelHtml += ` <span class="required-indicator">*</span>`; }
            label.innerHTML = labelHtml;
            const valueContainer = document.createElement('div');
            row.appendChild(label); row.appendChild(valueContainer);
            modalBody.appendChild(row);
            const isFieldLocked = lockedFields.includes(colSchema.colId);
            renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap, isEditing: true, isLocked: isFieldLocked });
    });

    modalOverlay.classList.add('is-open');
    _addModalFormListeners(); // Adiciona listeners após renderizar
    _validateModalForm();     // Valida o formulário ao abrir
}

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    if (modalOverlay) modalOverlay.classList.remove('is-open');
    currentOnSave = null;
    currentOnCancel = null;
    currentSchema = {};
    currentRequiredFields = []; // Limpa o estado
}

// Bloco de _handleSave inalterado para garantir completude
_handleSave = async function() { const changes = {}; const formElements = modalBody.querySelectorAll('[data-col-id]'); formElements.forEach(el => { const colId = el.dataset.colId; const colSchema = currentSchema[colId]; let value; if (el.type === 'checkbox') { value = el.checked; } else if (el.tagName === 'SELECT' && el.multiple) { value = Array.from(el.selectedOptions).map(opt => opt.value); value = value.length > 0 ? ['L', ...value] : null; } else { value = el.value; } if (colSchema) { if (colSchema.type.startsWith('Date')) { if (!value) { value = null; } else if (colSchema.type === 'Date') { const parts = value.split('-'); value = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2])) / 1000; } else { value = new Date(value).getTime() / 1000; } } else if (colSchema.type.startsWith('Ref')) { value = value ? parseInt(value, 10) : null; } } changes[colId] = value; }); if (currentOnSave) { try { await currentOnSave(changes); closeModal(); } catch (err) { console.error("Modal onSave callback FAILED. O erro foi:", err); alert("ERRO AO SALVAR: " + err.message); } } };