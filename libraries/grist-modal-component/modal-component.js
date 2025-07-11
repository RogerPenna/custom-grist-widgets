// libraries/grist-modal-component/modal-component.js
import { GristTableLens } from '../grist-table-lens/grist-table-lens.js';
import { GristDataWriter } from '../grist-data-writer.js';
import { renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

const tableLens = new GristTableLens(grist);
const dataWriter = new GristDataWriter(grist);

let modalOverlay, modalContent, modalTitle, modalBody;
let currentOnSave, currentOnCancel;
// MUDANÇA: O schema agora é um objeto. Inicializamos como tal.
let currentSchema = {}; 

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
    document.getElementById('modal-save-btn').addEventListener('click', _handleSave);
}


async function _handleSave() {
    const changes = {};
    const formElements = modalBody.querySelectorAll('[data-col-id]');
    
    formElements.forEach(el => {
        const colId = el.dataset.colId;
        // MUDANÇA: Acesso direto ao schema usando a chave, em vez de .find().
        const colSchema = currentSchema[colId];
        let value;

        // Lógica para extrair valor do elemento do formulário
        if (el.type === 'checkbox') {
            value = el.checked;
        } else if (el.tagName === 'SELECT' && el.multiple) {
            value = Array.from(el.selectedOptions).map(opt => opt.value);
            // Formato ChoiceList do Grist: ['L', 'val1', 'val2']
            value = value.length > 0 ? ['L', ...value] : null;
        } else {
            value = el.value;
        }

        // Lógica de conversão de tipo específica do Grist
        if (colSchema) {
            if (colSchema.type.startsWith('Date')) {
                if (!value) {
                    value = null;
                } else if (colSchema.type === 'Date') {
                    const parts = value.split('-');
                    value = Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) / 1000;
                } else { // DateTime
                    value = new Date(value).getTime() / 1000;
                }
            } else if (colSchema.type.startsWith('Ref')) {
                // Converte o valor do select (string) para número
                value = value ? parseInt(value, 10) : null;
            }
        }
        changes[colId] = value;
    });

    if (currentOnSave) {
        try {
            await currentOnSave(changes); 
            closeModal(); // Fecha o modal após o salvamento bem-sucedido
        } catch (err) {
            console.error("Modal onSave callback failed:", err);
            // Opcional: mostrar um erro para o usuário no modal
        }
    }
}

export function openModal(options) {
    _initializeModalDOM();
    const { title, record, schema, onSave, onCancel } = options;
    modalTitle.textContent = title;
    currentOnSave = onSave;
    currentOnCancel = onCancel;
    currentSchema = schema; // Salva o schema (objeto) para uso no _handleSave
    modalBody.innerHTML = '';
    
    // MUDANÇA: Como o schema agora é um objeto, usamos Object.values() para iterar.
    const schemaAsArray = Object.values(schema);
    const ruleIdToColIdMap = new Map();
    schemaAsArray.forEach(col => { if (col.colId?.startsWith('gristHelper_')) { ruleIdToColIdMap.set(col.id, col.colId); } });

    // Filtra para não mostrar colunas de fórmula ou helpers no formulário.
    schemaAsArray.filter(col => col && !col.isFormula && !col.colId.startsWith('gristHelper_')).forEach(colSchema => {
        const row = document.createElement('div'); row.className = 'modal-field-row';
        const label = document.createElement('label'); label.className = 'modal-field-label';
        label.textContent = colSchema.label || colSchema.colId;
        const valueContainer = document.createElement('div');
        row.appendChild(label); row.appendChild(valueContainer);
        modalBody.appendChild(row);

        // Passa o record original, que pode ter valores pré-preenchidos (como a ref ao pai).
        renderField({ container: valueContainer, colSchema, record, tableLens, ruleIdToColIdMap, isEditing: true });
    });
    modalOverlay.classList.add('is-open');
}

export function closeModal() {
    if (currentOnCancel) currentOnCancel();
    if (modalOverlay) modalOverlay.classList.remove('is-open');
    // Limpa o estado para evitar vazamentos de memória ou dados antigos
    currentOnSave = null;
    currentOnCancel = null;
    currentSchema = {};
}