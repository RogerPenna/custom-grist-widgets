// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let modalOverlay, modalContent, modalTitle, modalBody;
let currentOnSave, currentOnCancel;
let currentSchema = []; // Guardar o schema atual aqui

// ... (função _initializeModalDOM permanece a mesma) ...
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
    const formElements = modalBody.querySelectorAll('[data-col-id]');
    
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        const colSchema = currentSchema.find(c => c.colId === colId);
        let value = el.value;

        if (colSchema) {
            // Lógica Específica por tipo de coluna
            if (colSchema.type.startsWith('Date')) {
                 if (!value) {
                    value = null; // Envia nulo se o campo estiver vazio
                } else if (colSchema.type === 'Date') {
                    // =================================================================
                    // ========= CORREÇÃO DEFINITIVA PARA O BUG DE FUSO HORÁRIO ========
                    // =================================================================
                    const parts = value.split('-');
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1; // Mês em JS é 0-indexado (0-11).
                    const day = parseInt(parts[2], 10);
                    value = Date.UTC(year, month, day) / 1000;
                } else { // DateTime
                    value = new Date(value).getTime() / 1000;
                }
            } else if (el.type === 'checkbox') {
                value = el.checked;
            }
            // Adicionar lógica para 'select-multiple' (ChoiceList) aqui no futuro.
        }

        changes[colId] = value;
    });

    if (currentOnSave) {
        try {
            await currentOnSave(changes);
        } catch (err) {
            console.error("Modal onSave callback failed:", err);
        }
    }
    closeModal();
}

export function openModal(options) {
    _initializeModalDOM();
    const { title, tableId, record, schema, onSave, onCancel } = options;
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    currentSchema = schema; // Salva o schema para uso no _handleSave
    modalBody.innerHTML = '';
    
    const ruleIdToColIdMap = new Map();
    schema.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

    // Filtra para não mostrar colunas de fórmula no formulário de edição/adição
    schema.filter(col => !col.isFormula && !col.colId.startsWith('gristHelper_')).forEach(colSchema => {
        const row = document.createElement('div'); row.className = 'modal-field-row';
        const label = document.createElement('label'); label.className = 'modal-field-label';
        label.textContent = colSchema.label || colSchema.colId;
        const valueContainer = document.createElement('div');
        row.appendChild(label); row.appendChild(valueContainer);
        modalBody.appendChild(row);

        renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap, isEditing: true });
    });
    modalOverlay.classList.add('is-open');
}

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    if (modalOverlay) modalOverlay.classList.remove('is-open');
    currentOnSave = null;
    currentOnCancel = null;
    currentSchema = [];
}