import { getFieldStyle, renderField } from '../grist-field-renderer/grist-field-renderer.js';
import { publish } from '../grist-event-bus/grist-event-bus.js';

/*******************************************************************
 * CardSystem: A pure visualization component for the Grist Framework.
 *
 * - Renders "cards" using a 10-column grid layout based on provided options.
 * - Receives all its configuration (styling, layout, etc.) via an 'options' object.
 * - Does NOT contain any self-configuration UI.
 * - Emits a 'grf-card-clicked' event on click/burger icon click.
 *******************************************************************/
export const CardSystem = (() => {
  //--------------------------------------------------------------------
  // 1) Internal State + Defaults
  //--------------------------------------------------------------------
  
  const DEFAULT_FIELD_STYLE = {
    labelVisible: true, labelPosition: 'above', labelFont: 'inherit', labelFontSize: 'inherit', labelColor: 'inherit', labelOutline: false, labelOutlineColor: '#ffffff', dataJustify: 'left', heightLimited: false, maxHeightRows: 1, isTitleField: false
  };

  const DEFAULT_STYLING = {
    iconGroups: [],
    iconSize: 1.0,
    widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9",
    cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0",
    cardsColorApplyText: false, // <-- NOVA PROPRIEDADE
    cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc",
    cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px",
    cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px",
    handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0",
    widgetPadding: "10px", cardsSpacing: "15px",
	cardTitleTopBarApplyText: false,
    selectedCard: { enabled: false, scale: 1.05, colorEffect: "none" }
  };

  const DEFAULT_NUM_ROWS = 1;
  const NUM_COLS = 10;

  // Helper to load icons.svg
  let iconsLoaded = false;
  async function loadIcons() {
      if (iconsLoaded) return;
      try {
          const response = await fetch('../libraries/icons/icons.svg');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const svgText = await response.text();
          const div = document.createElement('div');
          div.style.display = 'none';
          div.innerHTML = svgText;
          document.body.insertBefore(div, document.body.firstChild);
          iconsLoaded = true;
      } catch (error) {
          console.error('Falha ao carregar o arquivo de \u00edcones:', error);
      }
  }
  const getIcon = (id) => `<svg class="icon"><use href="#${id}"></use></svg>`;

  //--------------------------------------------------------------------
  // 2) Public renderCards(container, records, options, schema)
  //--------------------------------------------------------------------
  async function renderCards(container, records, options, schema) { // Added async
    await loadIcons(); // Call loadIcons here
    const currentOptions = options || {};
    const tableLens = currentOptions.tableLens; // Extract tableLens
    const styling = { ...DEFAULT_STYLING, ...currentOptions.styling, selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(currentOptions.styling?.selectedCard || {}) } };
    const layout = currentOptions.layout || [];
    console.log("DEBUG: CardSystem received layout:", JSON.stringify(layout, null, 2));
    const viewMode = currentOptions.viewMode || 'click';
    const numRows = currentOptions.numRows || DEFAULT_NUM_ROWS;

    container.innerHTML = "";
    if (!records || !records.length) {
      container.textContent = "No records found.";
      return;
    }

    container.style.background = resolveStyle(null, null, styling.widgetBackgroundMode, styling.widgetBackgroundSolidColor, { type: styling.widgetBackgroundGradientType, c1: styling.widgetBackgroundGradientColor1, c2: styling.widgetBackgroundGradientColor2 }, styling.widgetBackgroundField);
    container.style.padding = styling.widgetPadding;

    records.forEach((record) => {
      const cardEl = document.createElement("div");
      cardEl.className = "cs-card";
      cardEl.style.display = "grid";
      cardEl.style.gridTemplateRows = `repeat(${numRows}, auto)`;
      cardEl.style.gridTemplateColumns = `repeat(${NUM_COLS}, 1fr)`;
      cardEl.style.gap = "4px";
      cardEl.style.marginBottom = styling.cardsSpacing;
      cardEl.style.borderRadius = "8px";
      cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      cardEl.style.position = "relative";
      cardEl.style.minHeight = "60px";
      cardEl.style.transition = "all 0.2s ease-in-out";

      // --- INÍCIO DA LÓGICA DE ESTILO DO CARD ATUALIZADA ---
      if (styling.cardsColorMode === 'conditional' && styling.cardsColorField) {
          const colSchema = schema[styling.cardsColorField];
          if (colSchema) {
              const fieldStyle = getFieldStyle(record, colSchema);
              // Aplica a cor de fundo (com fallback para a cor sólida padrão)
              cardEl.style.background = fieldStyle.fillColor || styling.cardsColorSolidColor;
              // APLICA A COR DE TEXTO SE A OPÇÃO ESTIVER MARCADA
              if (styling.cardsColorApplyText && fieldStyle.textColor) {
                  cardEl.style.color = fieldStyle.textColor;
              }
          } else {
              // Fallback se o campo configurado não for encontrado no schema
              cardEl.style.background = styling.cardsColorSolidColor;
          }
      } else {
          // A lógica antiga para Solid e Gradient permanece a mesma
          cardEl.style.background = resolveStyle(record, schema, styling.cardsColorMode, styling.cardsColorSolidColor, { type: styling.cardsColorGradientType, c1: styling.cardsColorGradientColor1, c2: styling.cardsColorGradientColor2 }, styling.cardsColorField);
      }
      // --- FIM DA LÓGICA DE ESTILO DO CARD ATUALIZADA ---

      if (styling.cardBorderThickness > 0) {
        const borderColor = resolveStyle(record, schema, styling.cardBorderMode, styling.cardBorderSolidColor, null, styling.cardBorderField);
        cardEl.style.border = `${styling.cardBorderThickness}px solid ${borderColor}`;
      } else {
        cardEl.style.border = "none";
      }

      const handleEl = document.createElement("div");
      handleEl.style.position = "absolute";
      handleEl.style.left = "0";
      handleEl.style.top = "0";
      handleEl.style.bottom = "0";
      handleEl.style.width = styling.handleAreaWidth;
      handleEl.style.background = resolveStyle(record, schema, styling.handleAreaMode, styling.handleAreaSolidColor, null, styling.handleAreaField);
      handleEl.style.borderTopLeftRadius = "8px";
      handleEl.style.borderBottomLeftRadius = "8px";
      cardEl.appendChild(handleEl);

      cardEl.style.paddingLeft = styling.handleAreaWidth;
      if (viewMode === "burger") {
        const burger = document.createElement("span");
        burger.innerHTML = "☰";
        burger.style.cssText = "position: absolute; left: 8px; top: 8px; font-size: 18px; color: #555; cursor: pointer; z-index: 2;";
        handleEl.appendChild(burger);
        burger.addEventListener("click", (e) => { e.stopPropagation(); handleCardClick(record, currentOptions); });
        cardEl.style.cursor = "default";
      } else {
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", () => { handleCardClick(record, currentOptions); });
      }

      if (styling.selectedCard?.enabled) {
        cardEl.addEventListener("mouseenter", () => { cardEl.style.transform = `scale(${styling.selectedCard.scale})`; cardEl.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)"; });
        cardEl.addEventListener("mouseleave", () => { cardEl.style.transform = "scale(1)"; cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"; });
      }

      const titleFields = layout.filter(f => f.style?.isTitleField);
      if (styling.cardTitleTopBarEnabled && titleFields.length > 0) {
        const topBarEl = document.createElement("div");
        topBarEl.style.gridRow = "1 / span 1";
        topBarEl.style.gridColumn = `1 / span ${NUM_COLS}`;
        topBarEl.style.padding = "4px 8px";
        topBarEl.style.display = "flex";
        topBarEl.style.alignItems = "center";
        topBarEl.style.gap = "16px";
        if (styling.cardTitleTopBarMode === 'conditional' && styling.cardTitleTopBarField) {
    const colSchema = schema[styling.cardTitleTopBarField];
    if (colSchema) {
        const fieldStyle = getFieldStyle(record, colSchema);
        
        // Aplica a cor de fundo (com fallback)
        topBarEl.style.background = fieldStyle.fillColor || styling.cardTitleTopBarSolidColor;

        // APLICA A COR DE TEXTO SE A OPÇÃO ESTIVER MARCADA
        // Nota: Isso afetará os labels "Label Style" e "Data Style" se eles não tiverem uma cor própria definida.
        if (styling.cardTitleTopBarApplyText && fieldStyle.textColor) {
            topBarEl.style.color = fieldStyle.textColor;
        }
    } else {
        topBarEl.style.background = styling.cardTitleTopBarSolidColor;
    }
} else {
    // A lógica antiga para Solid e Gradient permanece
    topBarEl.style.background = resolveStyle(record, schema, styling.cardTitleTopBarMode, styling.cardTitleTopBarSolidColor, { type: styling.cardTitleTopBarGradientType, c1: styling.cardTitleTopBarGradientColor1, c2: styling.cardTitleTopBarGradientColor2 }, styling.cardTitleTopBarField);
}
        topBarEl.style.borderTopLeftRadius = "8px";
        topBarEl.style.borderTopRightRadius = "8px";
        cardEl.appendChild(topBarEl);

        titleFields.forEach(f => {
          const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
          const tContainer = document.createElement("div");
          tContainer.style.display = "flex";
          tContainer.style.flexDirection = (fieldStyle.labelPosition === 'left' ? "row" : "column");
          tContainer.style.gap = "4px";
          if (fieldStyle.labelVisible) {
            const lblEl = document.createElement("div");
            const fieldSchema = schema ? schema[f.colId] : null;
            lblEl.textContent = fieldSchema ? (fieldSchema.label || f.colId) : f.colId;
            lblEl.style.fontFamily = styling.cardTitleTopBarLabelFontStyle;
            lblEl.style.fontSize = styling.cardTitleTopBarLabelFontSize;
            lblEl.style.color = styling.cardTitleTopBarLabelFontColor;
            tContainer.appendChild(lblEl);
          }
          const dataEl = document.createElement("div");
          dataEl.textContent = String(record[f.colId] ?? "");
          dataEl.style.fontFamily = styling.cardTitleTopBarDataFontStyle;
          dataEl.style.fontSize = styling.cardTitleTopBarDataFontSize;
          dataEl.style.color = styling.cardTitleTopBarDataFontColor;
          tContainer.appendChild(dataEl);
          topBarEl.appendChild(tContainer);
        });
      }



      layout.forEach(f => {
        if (f.isIconGroup) {
            const groupConfig = (styling.iconGroups || []).find(g => g.id === f.colId);
            if (!groupConfig || !groupConfig.buttons || groupConfig.buttons.length === 0) return;

            const groupContainer = document.createElement("div");
            groupContainer.style.gridRow = `${f.row + 1} / span ${f.rowSpan || 1}`;
            groupContainer.style.gridColumn = `${f.col + 1} / span ${f.colSpan || 1}`;
            groupContainer.style.padding = "4px";
            groupContainer.style.display = "flex";
            groupContainer.style.gap = "8px";
            groupContainer.style.alignItems = "center";

            let justifyContent = "center";
            if (groupConfig.alignment === 'left') justifyContent = "flex-start";
            if (groupConfig.alignment === 'right') justifyContent = "flex-end";
            groupContainer.style.justifyContent = justifyContent;

            groupConfig.buttons.forEach(buttonConfig => {
                const actionButton = document.createElement("button");
                actionButton.className = "cs-action-button";
                actionButton.innerHTML = getIcon(buttonConfig.icon || 'icon-link');
                actionButton.title = buttonConfig.tooltip || '';
                const iconSize = styling.iconSize || 1.0;
                actionButton.style.width = `${32 * iconSize}px`;
                actionButton.style.height = `${32 * iconSize}px`;
                actionButton.style.border = "1px solid #ccc";
                actionButton.style.background = "#f0f0f0";
                actionButton.style.borderRadius = "5px";
                actionButton.style.cursor = "pointer";
                actionButton.style.padding = "4px";
                actionButton.style.display = "flex";
                actionButton.style.justifyContent = "center";
                actionButton.style.alignItems = "center";
                actionButton.style.transition = "background-color 0.2s";

                actionButton.addEventListener('mouseenter', () => actionButton.style.background = '#e0e0e0');
                actionButton.addEventListener('mouseleave', () => actionButton.style.background = '#f0f0f0');

                actionButton.addEventListener("click", (e) => {
                    e.stopPropagation();
                    publish('grf-navigation-action-triggered', {
                        config: buttonConfig,
                        sourceRecord: record,
                        tableId: currentOptions.tableId
                    });
                });
                groupContainer.appendChild(actionButton);
            });

            cardEl.appendChild(groupContainer);
            return;
        }

        const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
        if (!record.hasOwnProperty(f.colId)) return;
        if (styling.cardTitleTopBarEnabled && fieldStyle.isTitleField) return;

        if (f.row >= 0 && f.row < numRows) {
          const fieldBox = document.createElement("div");
          fieldBox.style.gridRow = `${f.row + 1} / span ${f.rowSpan || 1}`;
          fieldBox.style.gridColumn = `${f.col + 1} / span ${f.colSpan || 1}`;
          fieldBox.style.padding = "4px";

if (styling.fieldBackground?.enabled) {
    const cardBaseColor = resolveStyle(record, schema, styling.cardsColorMode, styling.cardsColorSolidColor, null, styling.cardsColorField);
    fieldBox.style.backgroundColor = lightenHexColor(cardBaseColor, styling.fieldBackground.lightenPercentage || 15);
    fieldBox.style.borderRadius = '4px';
}

          fieldBox.style.display = "flex";
          fieldBox.style.flexDirection = (fieldStyle.labelPosition === 'left' ? "row" : "column");
          fieldBox.style.gap = (fieldStyle.labelPosition === 'left' ? "8px" : "2px");
          fieldBox.style.alignItems = (fieldStyle.labelPosition === 'left' ? "center" : "stretch");
          
          if (fieldStyle.labelVisible) {
            const labelEl = document.createElement("div");
            const fieldSchema = schema ? schema[f.colId] : null;
            let labelText = fieldSchema ? (fieldSchema.label || f.colId) : f.colId;

            // Append item count for RefList fields
            if (fieldSchema && fieldSchema.type.startsWith('RefList:')) {
                const refListValue = record[f.colId];
                const count = Array.isArray(refListValue) && refListValue[0] === 'L' ? refListValue.length - 1 : 0;
                labelText += ` (${count} itens)`;
            }

            labelEl.textContent = labelText;
            if (fieldStyle.isTitleField && !styling.cardTitleTopBarEnabled) {
              labelEl.style.fontWeight = "bold";
              labelEl.style.color = styling.cardTitleFontColor;
              labelEl.style.fontSize = styling.cardTitleFontSize;
              labelEl.style.fontFamily = styling.cardTitleFontStyle;
            } else {
              labelEl.style.fontFamily = fieldStyle.labelFont;
              labelEl.style.fontSize = fieldStyle.labelFontSize;
              labelEl.style.color = fieldStyle.labelColor;
            }
            fieldBox.appendChild(labelEl);
          }

          const valueContainer = document.createElement("div");
          // The renderer will handle justification, but we can keep height limits if needed.
          if (fieldStyle.heightLimited) {
            valueContainer.style.cssText += `overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: ${fieldStyle.maxHeightRows}; -webkit-box-orient: vertical;`;
          }
          
          // Delegate rendering to the field renderer
          renderField({
            container: valueContainer,
            colSchema: schema ? schema[f.colId] : null,
            record: record,
            isEditing: false,
            tableLens: tableLens,
            fieldStyle: fieldStyle, // Pass the whole field style object
            styling: styling // Pass the global styling object
          });

          fieldBox.appendChild(valueContainer);
          cardEl.appendChild(fieldBox);
        }
      });
      container.appendChild(cardEl);
    });
  }

  function handleCardClick(record, options) {
    const drawerConfigId = options?.sidePanel?.drawerConfigId;
    const tableId = options?.tableId;
    if (!drawerConfigId || !tableId) {
        console.warn("Nenhuma a\u00e7\u00e3o de clique configurada. Verifique a aba 'Actions' na configura\u00e7\u00e3o do card.", {options});
        return;
    }
    publish('grf-card-clicked', {
        drawerConfigId: drawerConfigId,
        recordId: record.id,
        tableId: tableId
    });
  }

  function resolveStyle(record, schema, mode, solidColor, gradientOptions, fieldName) {
    if (mode === 'gradient' && gradientOptions?.type) { return gradientOptions.type.replace('{c1}', gradientOptions.c1).replace('{c2}', gradientOptions.c2); }
    if (mode === 'conditional' && fieldName && record && schema?.[fieldName]) {
        const colSchema = schema[fieldName];
        const fieldStyle = getFieldStyle(record, colSchema);
        return fieldStyle.fillColor || solidColor;
    }
    return solidColor;
  }

  function lightenHexColor(hex, percent) {
    if (!hex || !hex.startsWith('#')) return hex;

    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    const p = percent / 100;

    r = Math.round(Math.min(255, r + (255 - r) * p));
    g = Math.round(Math.min(255, g + (255 - g) * p));
    b = Math.round(Math.min(255, b + (255 - b) * p));

    const toHex = c => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return { renderCards };
})();