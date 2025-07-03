// libraries/grist-field-renderer/grist-field-renderer.js

import { renderText } from './renderers/render-text.js';
import { renderDate } from './renderers/render-date.js';
import { renderRef } from './renderers/render-ref.js';
import { renderChoice } from './renderers/render-choice.js';
import { renderRefList } from './renderers/render-reflist.js';
import { renderBool } from './renderers/render-bool.js';

// Load shared styles once for all renderers
(function() {
    if (document.getElementById('grf-styles')) return;
    const link = document.createElement('link');
    link.id = 'grf-styles';
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-field-renderer/styles/renderer-styles.css';
    document.head.appendChild(link);
})();

function _applyStyles(element, colSchema, record, ruleIdToColIdMap) {
    // This function for conditional formatting remains correct.
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = '';
    element.style.fontStyle = ''; element.style.textAlign = '';
    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    if (wopts.alignment) { element.style.textAlign = wopts.alignment; }
    let styleAppliedByRule = false;
    if (colSchema.rules && Array.isArray(colSchema.rules) && colSchema.rules[0] === 'L') {
        const ruleOptions = wopts.rulesOptions || [];
        const ruleIdList = colSchema.rules.slice(1);
        for (let i = 0; i < ruleIdList.length; i++) {
            const ruleNumId = ruleIdList[i];
            const helperColId = ruleIdToColIdMap.get(ruleNumId);
            if (helperColId && record[helperColId] === true) {
                const style = ruleOptions[i];
                if (style) {
                     if (style.textColor) element.style.color = style.textColor;
                     if (style.fillColor) element.style.backgroundColor = style.fillColor;
                     if (style.fontBold) element.style.fontWeight = 'bold';
                     if (style.fontItalic) element.style.fontStyle = 'italic';
                }
                styleAppliedByRule = true;
                break;
            }
        }
    }
}

/**
 * The main exported function. It now acts as a clean orchestrator.
 */
export async function renderField(options) {
    const { container, colSchema, record, isEditing = false } = options;
    const cellValue = record ? record[colSchema.colId] : null;
    
    container.innerHTML = '';
    
    // Handle disabled state at the top level
    const isDisabled = isEditing && colSchema.isFormula;
    container.classList.toggle('is-disabled', isDisabled);
    // Pass down a modified `isEditing` flag so sub-renderers don't have to check isFormula
    const canEdit = isEditing && !isDisabled;

    const callOptions = { ...options, container, cellValue, isEditing: canEdit };

    // This is the clean "switchboard" logic
    switch (colSchema.type) {
        case 'RefList':
        case colSchema.type.startsWith('RefList:') && colSchema.type: // Handle new format too
            await renderRefList(callOptions);
            break;
        case 'Ref':
        case colSchema.type.startsWith('Ref:') && colSchema.type:
            await renderRef(callOptions);
            break;
        case 'Date':
        case 'DateTime':
        case colSchema.type.startsWith('Date') && colSchema.type:
            renderDate(callOptions);
            break;
        case 'Choice':
        case 'ChoiceList':
            renderChoice(callOptions);
            break;
        case 'Bool':
            renderBool(callOptions);
            break;
        case 'Text':
        case 'Numeric':
        case 'Int':
        case 'Any':
            renderText(callOptions);
            break;
        default:
            // Fallback for any other type
            container.textContent = String(cellValue);
    }
    
    // Apply conditional formatting only in read-only mode
    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap);
    }
}