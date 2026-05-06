// libraries/grist-field-renderer/grist-field-renderer.js

import { renderText } from './renderers/render-text.js';
import { renderDate } from './renderers/render-date.js';
import { renderRef } from './renderers/render-ref.js';
import { renderChoice } from './renderers/render-choice.js';
import { renderRefList } from './renderers/render-reflist.js';
import { renderBool } from './renderers/render-bool.js';
import { renderColorPicker } from './renderers/render-color-picker.js';
import { renderProgressBar } from './renderers/render-progress-bar.js';
import { renderToggle } from './renderers/render-toggle.js';
import { renderIndicatorJson } from './renderers/render-indicator-json.js';

(function () {
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
  const { container, colSchema, record, isEditing = false, labelElement, styleOverride, styling, tableLens, isChild = false } = options;

  console.log(`[renderField] Rendering field: ${colSchema?.colId}`, { isEditing, hasRecord: !!record });

  if (isChild && colSchema.type.startsWith('RefList')) {
    container.innerHTML = '<span class="error-msg">[Nested RefList not supported]</span>';
    return;
  }

  // 1. Configurações customizadas do nosso widget (Card/Drawer)
  const customFieldStyle = options.fieldStyle || options.styleOverride || {};
  const useGristStyle = customFieldStyle.useGristStyle !== false;

  console.log(`[renderField] customFieldStyle for ${colSchema?.colId}:`, customFieldStyle);

  // 2. Metadados do Grist (Formatação Condicional, cores da coluna, etc)
  let tableSchema = null;
  if (tableLens && record && record.gristHelper_tableId) {
    tableSchema = await tableLens.getTableSchema(record.gristHelper_tableId);
  }
  const gristMetadataStyle = getFieldStyle(record, colSchema, tableSchema);

  if (!colSchema) {
    container.textContent = String(record[options.colId] ?? '');
    return;
  }

  // Se o usuário desabilitou explicitamente o estilo do Grist para este campo
  if (!useGristStyle) {
    console.log(`[renderField] useGristStyle is false for ${colSchema.colId}, rendering simple text.`);
    renderSimpleText({ container, colSchema, record, styling });
    return;
  }

  const cellValue = record ? record[colSchema.colId] : null;
  container.innerHTML = '';
  container.classList.remove('has-conditional-style');

  const isDisabled = isEditing && colSchema.isFormula;
  container.classList.toggle('is-disabled', isDisabled);

  // 3. Aplicação de Estilos Visuais
  if (!isEditing) {
    // Primeiro aplicamos o estilo condicional do Grist
    _applyStyles(container, gristMetadataStyle);
    
    // Depois sobrepomos com os estilos fixos definidos no configurador (se existirem)
    if (customFieldStyle.dataStyle) {
        const ds = customFieldStyle.dataStyle;
        if (ds.font) container.style.fontFamily = ds.font;
        if (ds.size) container.style.fontSize = ds.size;
        if (ds.color) container.style.color = ds.color; 
        if (ds.bold) container.style.fontWeight = 'bold';
        if (ds.italic) container.style.fontStyle = 'italic';
    }
  }

  // 4. Despacho de Renderização (Prioridade para Widgets Customizados)
  const type = colSchema.type || '';
  const widgetType = (customFieldStyle.widget || '').toLowerCase().replace(/\s+/g, '');
  
  console.log(`[renderField] type: ${type}, widgetType: ${widgetType}`);

  const callOptions = { 
    ...options, 
    container, 
    cellValue, 
    fieldStyle: customFieldStyle,
    fieldOptions: customFieldStyle.widgetOptions || {}, 
    refListConfig: customFieldStyle.refListConfig,
    fieldConfig: customFieldStyle
  };

  // WIDGETS ESPECIAIS (Prioridade Máxima)
  if (customFieldStyle.widgetOptions?.colorPicker || widgetType === 'colorpicker') {
    console.log(`[renderField] Triggering renderColorPicker for ${colSchema.colId}`);
    renderColorPicker(callOptions);
    return;
  }

  if ((customFieldStyle.widgetOptions?.progressBar || widgetType === 'progressbar') && (type === 'Numeric' || type === 'Int')) {
    console.log(`[renderField] Triggering renderProgressBar for ${colSchema.colId}`);
    renderProgressBar(callOptions);
    return;
  }

  if (widgetType === 'toggleswitch' || widgetType === 'switch') {
    console.log(`[renderField] Triggering renderToggle for ${colSchema.colId}`);
    renderToggle(callOptions);
    return;
  }

  if (widgetType === 'indicatorjson') {
    console.log(`[renderField] Triggering renderIndicatorJson for ${colSchema.colId}`);
    renderIndicatorJson(callOptions);
    return;
  }

  // RENDERIZADORES POR TIPO DE DADO (Fallback)
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