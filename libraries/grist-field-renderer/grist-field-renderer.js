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
                return; // Se a regra condicional foi aplicada, TERMINA AQUI.
            }
        }
    }

    // =================================================================
    // =========== CORREÇÃO: Ignora Choice e ChoiceList aqui ===========
    // =================================================================
    // Se não houver regra condicional, aplica a formatação fixa da coluna,
    // EXCETO para Choice/ChoiceList, que cuidam de si mesmos.
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

    // =================================================================
    // ========= CORREÇÃO CRÍTICA: INVERTER ORDEM DE OPERAÇÕES =========
    // =================================================================
    
    // 1. Aplica estilos de cabeçalho (sempre)
    if (labelElement) {
        _applyStyles(labelElement, colSchema, record, options.ruleIdToColIdMap, true);
    }

    // 2. No modo de visualização, aplica os estilos GERAIS primeiro.
    // _applyStyles aplicará a formatação condicional (se houver) ou a formatação fixa (se não for Choice).
    if (!isEditing) {
        _applyStyles(container, colSchema, record, options.ruleIdToColIdMap, false);
    }

    // 3. AGORA chama o renderizador especialista.
    // Se for um Choice, ele poderá aplicar seus próprios estilos por cima da formatação fixa,
    // mas não por cima da formatação condicional (que já foi aplicada e fez a função retornar).
    const callOptions = { ...options, container, cellValue, isEditing: canEdit };

    switch (colSchema.type) {
        case 'RefList': case colSchema.type.startsWith('RefList:') && colSchema.type:
            await renderRefList(callOptions); break;
        case 'Ref': case colSchema.type.startsWith('Ref:') && colSchema.type:
            await renderRef(callOptions); break;
        case 'Date': case 'DateTime': case colSchema.type.startsWith('Date') && colSchema.type:
            renderDate(callOptions); break;
        case 'Choice': case 'ChoiceList':
            renderChoice(callOptions); break;
        case 'Bool':
            renderBool(callOptions); break;
        case 'Text': case 'Numeric': case 'Int': case 'Any':
            renderText(callOptions); break;
        default:
            container.textContent = String(cellValue ?? '(vazio)');
    }
}