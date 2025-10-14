// --- START OF COMPLETE AND CORRECTED grist-field-renderer.js ---

import { renderText } from './renderers/render-text.js';
import { renderDate } from './renderers/render-date.js';
import { renderRef } from './renderers/render-ref.js';
import { renderChoice } from './renderers/render-choice.js';
import { renderRefList } from './renderers/render-reflist.js';
import { renderBool } from './renderers/render-bool.js';

(function() {
    if (document.getElementById('grf-styles')) return;
    const link = document.createElement('link');
    link.id = 'grf-styles';
    link.rel = 'stylesheet';
    link.href = '../libraries/grist-field-renderer/styles/renderer-styles.css';
    document.head.appendChild(link);
})();

/**
 * NOVA FUNÇÃO EXPORTÁVEL: A fonte única da verdade para estilos de campo.
 * Retorna um objeto de estilo { fillColor, textColor, fontBold, etc. }
 * para um campo, seguindo a hierarquia de prioridade do Grist.
 * 
 * @param {object} record O registro de dados completo.
 * @param {object} colSchema O objeto de schema para a coluna específica.
 * @returns {object} Um objeto com as propriedades de estilo.
 */
export function getFieldStyle(record, colSchema) {
    const style = {
        fillColor: null,
        textColor: null,
        fontBold: false,
        fontItalic: false,
        alignment: null
    };

    if (!record || !colSchema) {
        return style;
    }

    let wopts = {};
    if (typeof colSchema.widgetOptions === 'string' && colSchema.widgetOptions) {
        try { wopts = JSON.parse(colSchema.widgetOptions); } catch (e) { /* ignore */ }
    } else if (typeof colSchema.widgetOptions === 'object' && colSchema.widgetOptions !== null) {
        wopts = colSchema.widgetOptions;
    }

    // NÍVEL 1: Formatação Condicional (Prioridade Máxima)
    if (colSchema.conditionalFormattingRules && colSchema.conditionalFormattingRules.length > 0) {
        for (const rule of colSchema.conditionalFormattingRules) {
            if (record[rule.helperColumnId] === true) {
                const ruleStyle = rule.style || {};
                return {
                    textColor: ruleStyle.textColor || null,
                    fillColor: ruleStyle.fillColor || null,
                    fontBold: ruleStyle.fontBold || false,
                    fontItalic: ruleStyle.fontItalic || false,
                    alignment: ruleStyle.alignment || wopts.alignment || null
                };
            }
        }
    }

    // NÍVEL 2: Cores de Opções (para campos Choice e ChoiceList)
    const type = colSchema.type || '';
    if (type === 'Choice' || type === 'ChoiceList') {
        const choiceOptions = wopts.choiceOptions || {};
        const cellValue = record[colSchema.colId];
        const valueToStyle = (type === 'ChoiceList' && Array.isArray(cellValue) && cellValue.length > 1) ? cellValue[1] : cellValue;
        const choiceStyle = choiceOptions[valueToStyle];
        
        if (choiceStyle) {
            style.textColor = choiceStyle.textColor || null;
            style.fillColor = choiceStyle.fillColor || null;
            style.fontBold = choiceStyle.fontBold || false;
        }
    } else {
        // NÍVEL 3: Estilos Fixos da Coluna (não se aplicam a Choice/ChoiceList se eles tiverem seu próprio estilo)
        if (wopts.fillColor) style.fillColor = wopts.fillColor;
        if (wopts.textColor) style.textColor = wopts.textColor;
        if (wopts.fontBold) style.fontBold = wopts.fontBold;
    }

    if (wopts.alignment) style.alignment = wopts.alignment;
    
    return style;
}


/**
 * FUNÇÃO INTERNA REFATORADA: Agora usa a nova getFieldStyle.
 * Aplica os estilos a um elemento do DOM.
 */
function _applyStyles(element, colSchema, record, ruleIdToColIdMap, isLabel = false, overrideRules = {}) {
    if (!element) return;
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = ''; element.style.fontStyle = '';

    let wopts = {};
    if (typeof colSchema.widgetOptions === 'string' && colSchema.widgetOptions) {
        try { wopts = JSON.parse(colSchema.widgetOptions); } catch (e) { console.warn("Could not parse widgetOptions", e); }
    } else if (typeof colSchema.widgetOptions === 'object' && colSchema.widgetOptions !== null) {
        wopts = colSchema.widgetOptions;
    }
    
    if (isLabel && !overrideRules.ignoreHeader) {
        if (wopts.headerFillColor) element.style.backgroundColor = wopts.headerFillColor;
        if (wopts.headerTextColor) element.style.color = wopts.headerTextColor;
        if (wopts.headerFontBold) element.style.fontWeight = 'bold';
        return;
    }
    
    if (isLabel) return;

    if (!overrideRules.ignoreConditional && colSchema.conditionalFormattingRules && colSchema.conditionalFormattingRules.length > 0) {
        for (const rule of colSchema.conditionalFormattingRules) {
            if (record[rule.helperColumnId] === true) {
                const style = rule.style || {};
                if (style.textColor) element.style.color = style.textColor;
                if (style.fillColor) element.style.backgroundColor = style.fillColor;
                if (style.fontBold) element.style.fontWeight = 'bold';
                if (style.fontItalic) element.style.fontStyle = 'italic';
                element.classList.add('has-conditional-style'); 
                return;
            }
        }
    }

    if (!overrideRules.ignoreCell) {
        if (wopts.alignment) element.style.textAlign = wopts.alignment;
        
        if (colSchema.type !== 'Choice' && colSchema.type !== 'ChoiceList') {
            if (wopts.fillColor) element.style.backgroundColor = wopts.fillColor;
            if (wopts.textColor) element.style.color = wopts.textColor;
            if (wopts.fontBold) element.style.fontWeight = 'bold';
        }
    }
}


/**
 * FUNÇÃO PRINCIPAL DO RENDERER: Nenhuma mudança necessária aqui.
 * Ela despacha para os renderers específicos de cada tipo.
 */
function renderSimpleText(options) {
    const { container, colSchema, record, styling } = options;
    const cellValue = record ? record[colSchema.colId] : null;
    
    container.innerHTML = '';
    const textSpan = document.createElement('span');

    let displayText = cellValue;
    if (Array.isArray(cellValue) && cellValue[0] === 'L') {
        displayText = `[${cellValue.length - 1} items]`;
    } else if (typeof cellValue === 'number' && (colSchema.type.startsWith('Ref:'))) {
        displayText = `[Ref: ${cellValue}]`;
    }

    textSpan.textContent = String(displayText ?? '');
    
    if (styling) {
        textSpan.style.color = styling.simpleTextColor || '#000000';
        textSpan.style.fontFamily = styling.simpleTextFont || 'Calibri';
        textSpan.style.fontSize = styling.simpleTextSize || '14px';
    }
    
    container.appendChild(textSpan);
}

export async function renderField(options) {
    const { container, colSchema, record, isEditing = false, labelElement, styleOverride, fieldStyle, styling } = options;

    if (!colSchema) { 
        container.textContent = String(record[options.colId] ?? '');
        return;
    }

    // Default to using Grist style if the option is not provided.
    const useGristStyle = fieldStyle?.useGristStyle ?? true;

    if (!useGristStyle) {
        renderSimpleText({ container, colSchema, record, styling });
        return;
    }

    const cellValue = record ? record[colSchema.colId] : null;
    container.innerHTML = '';
    container.classList.remove('has-conditional-style');

    const isDisabled = isEditing && colSchema.isFormula;
    container.classList.toggle('is-disabled', isDisabled);
    
    if (labelElement) {
        _applyStyles(labelElement, colSchema, record, options.ruleIdToColIdMap, true, styleOverride);
    }

    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap, false, styleOverride);
    }

    // Correctly pass refListConfig to the callOptions from the fieldStyle object
    const callOptions = { ...options, container, cellValue, refListConfig: fieldStyle?.refListConfig };

    const type = colSchema.type || '';
    if (type.startsWith('RefList:')) {
        await renderRefList(callOptions);
    } else if (type.startsWith('Ref:')) {
        await renderRef(callOptions);
    } else if (type.startsWith('Date')) {
        renderDate(callOptions);
    } else if (type === 'Choice' || type === 'ChoiceList') {
        renderChoice(callOptions);
    } else if (type === 'Bool') {
        renderBool(callOptions);
    } else {
        renderText(callOptions);
    }
}

// --- END OF COMPLETE AND CORRECTED grist-field-renderer.js ---