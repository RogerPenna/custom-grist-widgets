// libraries/grist-field-renderer/grist-field-renderer.js

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

function _applyStyles(element, colSchema, record, ruleIdToColIdMap, isLabel = false) {
    if (!element) return;
    element.style.color = ''; element.style.backgroundColor = ''; element.style.fontWeight = ''; element.style.fontStyle = '';

    let wopts = {};
    if (typeof colSchema.widgetOptions === 'string' && colSchema.widgetOptions) {
        try {
            wopts = JSON.parse(colSchema.widgetOptions);
        } catch (e) {
            console.warn("Could not parse widgetOptions string:", colSchema.widgetOptions, e);
        }
    } else if (typeof colSchema.widgetOptions === 'object' && colSchema.widgetOptions !== null) {
        wopts = colSchema.widgetOptions; // Já é um objeto, use diretamente.
    }
    
    // Formatação do Cabeçalho (sempre aplicada)
    if (isLabel) {
        if (wopts.headerFillColor) element.style.backgroundColor = wopts.headerFillColor;
        if (wopts.headerTextColor) element.style.color = wopts.headerTextColor;
        if (wopts.headerFontBold) element.style.fontWeight = 'bold';
        return;
    }

    // Alinhamento para a Célula de Valor
    if (wopts.alignment) element.style.textAlign = wopts.alignment;
    
    // NÍVEL 1: Formatação Condicional (sempre tem prioridade)
    if (colSchema.conditionalFormattingRules && colSchema.conditionalFormattingRules.length > 0) {
        for (const rule of colSchema.conditionalFormattingRules) {
            if (record[rule.helperColumnId] === true) {
                const style = rule.style || {};
                if (style.textColor) element.style.color = style.textColor;
                if (style.fillColor) element.style.backgroundColor = style.fillColor;
                if (style.fontBold) element.style.fontWeight = 'bold';
                if (style.fontItalic) element.style.fontStyle = 'italic';
                return; // Se a regra condicional foi aplicada, TERMINA AQUI.
            }
        }
    }

    // NÍVEL 3: Formatação fixa da coluna (a mais baixa prioridade)
    if (colSchema.type !== 'Choice' && colSchema.type !== 'ChoiceList') {
        if (wopts.fillColor) element.style.backgroundColor = wopts.fillColor;
        if (wopts.textColor) element.style.color = wopts.textColor;
        if (wopts.fontBold) element.style.fontWeight = 'bold';
    }
}

export async function renderField(options) {
    const { container, colSchema, record, isEditing = false, isLocked = false, labelElement } = options;
    
    if (!colSchema) { 
        container.textContent = String(record[options.colId] ?? '');
        return;
    }

    const cellValue = record ? record[colSchema.colId] : null;
    
    container.innerHTML = '';

    const isDisabled = isEditing && colSchema.isFormula;
    container.classList.toggle('is-disabled', isDisabled);
    
    if (labelElement) {
        _applyStyles(labelElement, colSchema, record, options.ruleIdToColIdMap, true);
    }

    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap, false);
    }

    // A passagem de `...options` garante que qualquer configuração extra, como `fieldConfig`,
    // seja propagada para o renderizador especialista correto.
    const callOptions = { ...options, container, cellValue };

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
    } else if (['Text', 'Numeric', 'Int', 'Any'].includes(type)) {
        renderText(callOptions);
    } else {
        renderText(callOptions); // Default para texto
    }
}