// --- START OF COMPLETE AND CORRECTED CardSystem.js ---

import { getFieldStyle } from '../grist-field-renderer/grist-field-renderer.js';
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
    widgetBackgroundMode: "solid", widgetBackgroundSolidColor: "#f9f9f9", widgetBackgroundGradientType: "linear-gradient(to right, {c1}, {c2})", widgetBackgroundGradientColor1: "#f9f9f9", widgetBackgroundGradientColor2: "#e9e9e9",
    cardsColorMode: "solid", cardsColorSolidColor: "#ffffff", cardsColorGradientType: "linear-gradient(to right, {c1}, {c2})", cardsColorGradientColor1: "#ffffff", cardsColorGradientColor2: "#f0f0f0",
    cardBorderThickness: 0, cardBorderMode: "solid", cardBorderSolidColor: "#cccccc",
    cardTitleFontColor: "#000000", cardTitleFontStyle: "Calibri", cardTitleFontSize: "20px",
    cardTitleTopBarEnabled: false, cardTitleTopBarMode: "solid", cardTitleTopBarSolidColor: "#dddddd", cardTitleTopBarGradientType: "linear-gradient(to right, {c1}, {c2})", cardTitleTopBarGradientColor1: "#dddddd", cardTitleTopBarGradientColor2: "#cccccc", cardTitleTopBarLabelFontColor: "#000000", cardTitleTopBarLabelFontStyle: "Calibri", cardTitleTopBarLabelFontSize: "16px", cardTitleTopBarDataFontColor: "#333333", cardTitleTopBarDataFontStyle: "Calibri", cardTitleTopBarDataFontSize: "16px",
    handleAreaWidth: "8px", handleAreaMode: "solid", handleAreaSolidColor: "#40E0D0",
    widgetPadding: "10px", cardsSpacing: "15px",
    selectedCard: { enabled: false, scale: 1.05, colorEffect: "none" }
  };

  const DEFAULT_NUM_ROWS = 1;
  const NUM_COLS = 10;

  //--------------------------------------------------------------------
  // 2) Public renderCards(container, records, options, schema)
  //--------------------------------------------------------------------
  function renderCards(container, records, options, schema) {
    const currentOptions = options || {};
    const styling = { ...DEFAULT_STYLING, ...currentOptions.styling, selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(currentOptions.styling?.selectedCard || {}) } };
    const layout = currentOptions.layout || [];
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
      cardEl.style.background = resolveStyle(record, schema, styling.cardsColorMode, styling.cardsColorSolidColor, { type: styling.cardsColorGradientType, c1: styling.cardsColorGradientColor1, c2: styling.cardsColorGradientColor2 }, styling.cardsColorField);
      cardEl.style.marginBottom = styling.cardsSpacing;
      cardEl.style.borderRadius = "8px";
      cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      cardEl.style.position = "relative";
      cardEl.style.minHeight = "60px";
      cardEl.style.transition = "all 0.2s ease-in-out";

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

      // --- LOG DE DEPURAÇÃO PARA O MODO DE VISUALIZAÇÃO ---
      console.log(`[CardSystem Render] Para o card do registro ${record.id}, o viewMode é: '${viewMode}'`);

      if (viewMode === "burger") {
          console.log(`[CardSystem Render] Adicionando listener de clique no ÍCONE BURGER.`);
          const burger = document.createElement("span");
          burger.innerHTML = "☰";
          burger.style.cssText = "position: absolute; left: 8px; top: 8px; font-size: 18px; color: #555; cursor: pointer; z-index: 2;";
          handleEl.appendChild(burger);
          burger.addEventListener("click", (e) => {
              console.log("[CardSystem Click] ÍCONE BURGER CLICADO!");
              e.stopPropagation();
              openSidePanel(record, currentOptions);
          });
          cardEl.style.cursor = "default";
      } else if (viewMode === "click") {
          console.log(`[CardSystem Render] Adicionando listener de clique no CARD INTEIRO.`);
          cardEl.style.cursor = "pointer";
          cardEl.addEventListener("click", () => {
              console.log("[CardSystem Click] CARD INTEIRO CLICADO!");
              openSidePanel(record, currentOptions);
          });
      } else {
          console.warn(`[CardSystem Render] viewMode ('${viewMode}') não reconhecido. Nenhum listener de clique foi adicionado.`);
          cardEl.style.cursor = "default";
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
        topBarEl.style.background = resolveStyle(record, schema, styling.cardTitleTopBarMode, styling.cardTitleTopBarSolidColor, { type: styling.cardTitleTopBarGradientType, c1: styling.cardTitleTopBarGradientColor1, c2: styling.cardTitleTopBarGradientColor2 }, styling.cardTitleTopBarField);
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
        const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
        if (!record.hasOwnProperty(f.colId)) return;
        if (styling.cardTitleTopBarEnabled && fieldStyle.isTitleField) return;

        if (f.row >= 0 && f.row < numRows) {
          const fieldBox = document.createElement("div");
          fieldBox.style.gridRow = `${f.row + 1}`;
          fieldBox.style.gridColumn = `${f.col + 1} / span ${f.colSpan || 1}`;
          fieldBox.style.padding = "4px";
          fieldBox.style.display = "flex";
          fieldBox.style.flexDirection = (fieldStyle.labelPosition === 'left' ? "row" : "column");
          fieldBox.style.gap = (fieldStyle.labelPosition === 'left' ? "8px" : "2px");
          fieldBox.style.alignItems = (fieldStyle.labelPosition === 'left' ? "center" : "stretch");
          
          if (fieldStyle.labelVisible) {
            const labelEl = document.createElement("div");
            const fieldSchema = schema ? schema[f.colId] : null;
            const labelText = fieldSchema ? (fieldSchema.label || f.colId) : f.colId;
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

          const valueEl = document.createElement("div");
          valueEl.style.textAlign = fieldStyle.dataJustify;
          if (fieldStyle.heightLimited) {
            valueEl.style.cssText += `overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: ${fieldStyle.maxHeightRows}; -webkit-box-orient: vertical;`;
          }
          valueEl.textContent = String(record[f.colId] ?? "");
          fieldBox.appendChild(valueEl);
          cardEl.appendChild(fieldBox);
        }
      });
      container.appendChild(cardEl);
    });
  }

  //--------------------------------------------------------------------
  // 3) Helper Functions
  //--------------------------------------------------------------------
  
  // FUNÇÃO ATUALIZADA para emitir um evento em vez de logar no console.
function openSidePanel(record, options) {
    // --- LOG DE DEPURAÇÃO DEFINITIVO ---
    console.log("[openSidePanel] Função acionada. Verificando o objeto 'options' recebido:", options);
    // --- FIM DO LOG ---

    const drawerConfigId = options?.sidePanel?.drawerConfigId;
    const tableId = options?.tableId;

    if (!drawerConfigId || !tableId) {
        console.warn("Nenhuma ação de clique configurada. Verifique se 'drawerConfigId' e 'tableId' existem no objeto 'options' acima.", {
            drawerConfigId_Encontrado: drawerConfigId,
            tableId_Encontrado: tableId
        });
        return;
    }

    console.log("Card clicado. Emitindo evento 'grf-card-clicked'...", { drawerConfigId, recordId: record.id, tableId });
    publish('grf-card-clicked', {
        drawerConfigId: drawerConfigId,
        recordId: record.id,
        tableId: tableId
    });
}

  function resolveStyle(record, schema, mode, solidColor, gradientOptions, fieldName) {
    if (mode === 'gradient' && gradientOptions && gradientOptions.type) {
        return gradientOptions.type.replace('{c1}', gradientOptions.c1).replace('{c2}', gradientOptions.c2);
    }
    if (mode === 'conditional' && fieldName && record && schema && schema[fieldName]) {
        const colSchema = schema[fieldName];
        const fieldStyle = getFieldStyle(record, colSchema);
        return fieldStyle.fillColor || solidColor;
    }
    return solidColor;
  }

  //--------------------------------------------------------------------
  // 4) Public API
  //--------------------------------------------------------------------
  return {
    renderCards
  };
})();

// --- END OF COMPLETE AND CORRECTED CardSystem.js ---