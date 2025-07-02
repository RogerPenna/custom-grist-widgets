// libraries/grist-field-renderer/grist-field-renderer.js
import { renderText } from './renderers/render-text.js';
import { renderDate } from './renderers/render-date.js';
import { renderRef } from './renderers/render-ref.js';
import { renderChoice } from './renderers/render-choice.js';
import { renderRefList } from './renderers/render-reflist.js'; // Assuming this exists
import { renderBool } from './renderers/render-bool.js';

// Load styles once
(function() {
    if (document.getElementById('grf-styles')) return;
    const link = document.createElement('link');
    link.id = 'grf-styles';
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-field-renderer/styles/renderer-styles.css';
    document.head.appendChild(link);
})();

function _applyStyles(element, colSchema, record, ruleIdToColIdMap) { /* ... same styling logic ... */ }

export async function renderField(options) {
    const { container, colSchema, record, isEditing = false } = options;
    const cellValue = record ? record[colSchema.colId] : null;
    
    // The field renderer should not know about drawers, it just gets a container.
    // So we clear it here.
    container.innerHTML = '';
    
    // Add a class to grey out the field if it's a formula in edit mode.
    container.classList.toggle('is-disabled', isEditing && colSchema.isFormula);

    const callOptions = { ...options, container, colSchema, cellValue, isEditing };

    // The Grand Central Station of rendering
    if (cellValue === null || cellValue === undefined) {
        container.textContent = '(vazio)';
        container.className += ' grf-readonly-empty';
    } else if (colSchema.type.startsWith('RefList:')) {
        await renderRefList(callOptions);
    } else if (colSchema.type.startsWith('Ref:')) {
        await renderRef(callOptions);
    } else if (colSchema.type.startsWith('Date')) {
        renderDate(callOptions);
    } else if (colSchema.type.startsWith('Choice')) {
        renderChoice(callOptions);
    } else if (colSchema.type === 'Bool') {
        renderBool(callOptions);
    } else if (['Text', 'Numeric', 'Int', 'Any'].includes(colSchema.type)) {
        renderText(callOptions);
    } else {
        // Fallback for any other type
        container.textContent = String(cellValue);
    }
    
    // Apply conditional formatting only in read-only mode
    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap);
    }
}