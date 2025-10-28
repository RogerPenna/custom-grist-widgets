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
export function getFieldStyle(record, colSchema, tableSchema) {
  const mergedStyle = {
    fillColor: null,
    textColor: null,
    fontBold: false,
    fontItalic: false,
    alignment: null,
  };

  if (!record || !colSchema) {
    return mergedStyle;
  }

  const wopts = colSchema.widgetOptions ? (typeof colSchema.widgetOptions === 'string' ? JSON.parse(colSchema.widgetOptions) : colSchema.widgetOptions) : {};
  
  // Start with base column styles
  mergedStyle.fillColor = wopts.fillColor || null;
  mergedStyle.textColor = wopts.textColor || null;
  mergedStyle.fontBold = wopts.fontBold || false;
  mergedStyle.fontItalic = wopts.fontItalic || false;
  mergedStyle.alignment = wopts.alignment || null;

  if (tableSchema && colSchema.conditionalFormattingRules) {
    const conditionalFormattingRules = colSchema.conditionalFormattingRules || [];
    const rulesOptions = colSchema.widgetOptions?.rulesOptions || [];
    const rules = (colSchema.rules || []).slice(1).map(String);

    let lastMatchingRuleStyle = null;

    // Iterate through rules in order to find the last matching one
    for (const cfRule of conditionalFormattingRules) {
      if (record[cfRule.helperColumnId] === true) {
        const ruleIndex = rules.indexOf(cfRule.id);
        const ruleStyle = rulesOptions[ruleIndex];
        if (ruleStyle) {
          lastMatchingRuleStyle = ruleStyle;
        }
      }
    }

    if (lastMatchingRuleStyle) {
      if (lastMatchingRuleStyle.fillColor && lastMatchingRuleStyle.fillColor !== 'transparent') {
        mergedStyle.fillColor = lastMatchingRuleStyle.fillColor;
      }
      if (lastMatchingRuleStyle.textColor && lastMatchingRuleStyle.textColor !== 'transparent') {
        mergedStyle.textColor = lastMatchingRuleStyle.textColor;
      }
      if (lastMatchingRuleStyle.fontBold) {
        mergedStyle.fontBold = true;
      }
      if (lastMatchingRuleStyle.fontItalic) {
        mergedStyle.fontItalic = true;
      }
      // Add other style properties as needed
    }
  }

  return mergedStyle;
}


/**
 * FUNÇÃO INTERNA REFATORADA: Agora usa a nova getFieldStyle.
 * Aplica os estilos a um elemento do DOM.
 */
function _applyStyles(element, fieldStyle) {
    if (!element) return;

    element.style.color = fieldStyle.textColor || '';
    element.style.backgroundColor = fieldStyle.fillColor || '';
    element.style.fontWeight = fieldStyle.fontBold ? 'bold' : '';
    element.style.fontStyle = fieldStyle.fontItalic ? 'italic' : '';
    element.style.textAlign = fieldStyle.alignment || '';

    if (fieldStyle.fillColor || fieldStyle.textColor || fieldStyle.fontBold || fieldStyle.fontItalic) {
        element.classList.add('has-conditional-style');
    } else {
        element.classList.remove('has-conditional-style');
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
    const { container, colSchema, record, isEditing = false, labelElement, styleOverride, styling, tableLens } = options;

    let tableSchema = null;
    if (tableLens && record && record.gristHelper_tableId) {
        tableSchema = await tableLens.getTableSchema(record.gristHelper_tableId);
    }

    const fieldStyle = getFieldStyle(record, colSchema, tableSchema);

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
        // We probably don't want to apply conditional styles to the label
        // _applyStyles(labelElement, ...);
    }

    if (!isEditing) {
        _applyStyles(container, fieldStyle);
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