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

    const wopts = JSON.parse(colSchema.widgetOptions || '{}');
    let styleApplied = false;

    // Formatação do Cabeçalho
    if (isLabel) {
        if (wopts.headerFillColor) element.style.backgroundColor = wopts.headerFillColor;
        if (wopts.headerTextColor) element.style.color = wopts.headerTextColor;
        if (wopts.headerFontBold) element.style.fontWeight = 'bold';
        return;
    }

    // Alinhamento para a Célula de Valor
    if (wopts.alignment) element.style.textAlign = wopts.alignment;
    
    // NÍVEL 1: Formatação Condicional (MAIOR PRIORIDADE)
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
                styleApplied = true;
                break;
            }
        }
    }

    if (styleApplied) return;

    // NÍVEL 2: Formatação Fixa da Coluna (NÃO se aplica a Choice/ChoiceList)
    // O render-choice já tratou sua própria formatação (choiceOptions), que tem prioridade.
    if (colSchema.type !== 'Choice' && colSchema.type !== 'ChoiceList') {
        if (wopts.fillColor) element.style.backgroundColor = wopts.fillColor;
        if (wopts.textColor) element.style.color = wopts.textColor;
        if (wopts.fontBold) element.style.fontWeight = 'bold';
    }
}

export async function renderField(options) {
    const { container, colSchema, record, isEditing = false, labelElement } = options;
    const cellValue = record ? record[colSchema.colId] : null;
    
    container.innerHTML = '';
    
    const isDisabled = isEditing && colSchema.isFormula;
    container.classList.toggle('is-disabled', isDisabled);
    const canEdit = isEditing && !isDisabled;

    const callOptions = { ...options, container, cellValue, isEditing: canEdit, labelElement };

    // O switchboard permanece o mesmo...
    switch (colSchema.type) {
        case 'RefList': case colSchema.type.startsWith('RefList:') && colSchema.type:
            await renderRefList(callOptions); break;
        // ... outros cases ...
        case 'Choice': case 'ChoiceList':
            renderChoice(callOptions); break;
        default:
            container.textContent = String(cellValue ?? '(vazio)');
    }
    
    // =========================================================================
    // ========= CORREÇÃO: Aplica estilos de cabeçalho SEMPRE ==================
    // =========================================================================
    // O estilo do label não depende do modo de edição.
    if (labelElement) {
        _applyStyles(labelElement, colSchema, record, options.ruleIdToColIdMap, true);
    }
    
    // A formatação do VALOR da célula só acontece no modo de visualização.
    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap, false);
    }
}