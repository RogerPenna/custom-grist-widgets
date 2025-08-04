/*******************************************************************
 * CardSystem: A pure visualization component for the Grist Framework.
 *
 * - Renders "cards" using a 10-column grid layout based on provided options.
 * - Receives all its configuration (styling, layout, etc.) via an 'options' object.
 * - Does NOT contain any self-configuration UI.
 * - Triggers an 'openSidePanel' action on click/burger icon click.
 *******************************************************************/
const CardSystem = (() => {
  //--------------------------------------------------------------------
  // 1) Internal State + Defaults
  // - These are used as fallbacks if the options object is incomplete.
  //--------------------------------------------------------------------
  
  // Field-specific styling defaults
  const DEFAULT_FIELD_STYLE = {
    labelVisible: true,
    labelPosition: 'above',
    labelFont: 'inherit',
    labelFontSize: 'inherit',
    labelColor: 'inherit',
    labelOutline: false,
    labelOutlineColor: '#ffffff',
    dataJustify: 'left',
    heightLimited: false,
    maxHeightRows: 1,
    isTitleField: false
  };

  // Expanded styling defaults. 
  const DEFAULT_STYLING = {
    widgetBackgroundMode: "solid",
    widgetBackgroundSolidColor: "#f9f9f9",
    cardsColorMode: "solid",
    cardsColorSolidColor: "#ffffff",
    cardBorderThickness: 0,
    cardBorderMode: "solid",
    cardBorderSolidColor: "#cccccc",
    cardTitleFontColor: "#000000",
    cardTitleFontStyle: "Calibri",
    cardTitleFontSize: "20px",
    cardTitleTopBarEnabled: false,
    cardTitleTopBarMode: "solid",
    cardTitleTopBarSolidColor: "#dddddd",
    cardTitleTopBarLabelFontColor: "#000000",
    cardTitleTopBarLabelFontStyle: "Calibri",
    cardTitleTopBarLabelFontSize: "16px",
    cardTitleTopBarDataFontColor: "#333333",
    cardTitleTopBarDataFontStyle: "Calibri",
    cardTitleTopBarDataFontSize: "16px",
    handleAreaWidth: "8px",
    handleAreaMode: "solid",
    handleAreaSolidColor: "#40E0D0",
    widgetPadding: "10px",
    cardsSpacing: "15px",
    selectedCard: {
      enabled: false,
      scale: 1.05
    }
  };

  const DEFAULT_NUM_ROWS = 1;
  const NUM_COLS = 10;

  //--------------------------------------------------------------------
  // 2) Public renderCards(container, records, options)
  // - The single entry point for the component.
  //--------------------------------------------------------------------
  function renderCards(container, records, options) {
    // Merge provided options with defaults to ensure all properties exist
    const currentOptions = options || {};
    const styling = { ...DEFAULT_STYLING, ...currentOptions.styling, selectedCard: { ...DEFAULT_STYLING.selectedCard, ...(currentOptions.styling?.selectedCard || {}) } };
    const layout = currentOptions.layout || [];
    const viewMode = currentOptions.viewMode || 'click';
    const numRows = currentOptions.numRows || DEFAULT_NUM_ROWS;

    // Basic checks
    container.innerHTML = "";
    if (!records || !records.length) {
      container.textContent = "No records found.";
      return;
    }

    // 2.1) Apply widget-level styling
    const widgetBg = resolveColor(
      styling.widgetBackgroundMode,
      styling.widgetBackgroundSolidColor,
      null, // gradient not implemented in this version
      styling.widgetBackgroundField
    );
    container.style.background = widgetBg;
    container.style.padding = styling.widgetPadding;

    // 2.2) For each record, create a "Card"
    records.forEach((record) => {
      const cardEl = document.createElement("div");
      cardEl.className = "cs-card";
      cardEl.style.display = "grid";
      cardEl.style.gridTemplateRows = `repeat(${numRows}, auto)`;
      cardEl.style.gridTemplateColumns = `repeat(${NUM_COLS}, 1fr)`;
      cardEl.style.gap = "4px";
      cardEl.style.background = resolveColor(styling.cardsColorMode, styling.cardsColorSolidColor, null, styling.cardsColorField);
      cardEl.style.marginBottom = styling.cardsSpacing;
      cardEl.style.borderRadius = "8px";
      cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      cardEl.style.position = "relative";
      cardEl.style.minHeight = "60px";
      cardEl.style.transition = "all 0.2s ease-in-out";

      // Card border
      if (styling.cardBorderThickness > 0) {
        const borderCol = (styling.cardBorderMode === "conditional") ? "#ffffff" : styling.cardBorderSolidColor;
        cardEl.style.border = `${styling.cardBorderThickness}px solid ${borderCol}`;
      } else {
        cardEl.style.border = "none";
      }

      // 2.2.1) Create handle area
      const handleEl = document.createElement("div");
      handleEl.style.position = "absolute";
      handleEl.style.left = "0";
      handleEl.style.top = "0";
      handleEl.style.bottom = "0";
      handleEl.style.width = styling.handleAreaWidth;
      handleEl.style.background = resolveColor(styling.handleAreaMode, styling.handleAreaSolidColor, null, styling.handleAreaField);
      handleEl.style.borderTopLeftRadius = "8px";
      handleEl.style.borderBottomLeftRadius = "8px";
      cardEl.appendChild(handleEl);

      // 2.2.2) Set up click/burger behavior
      cardEl.style.paddingLeft = styling.handleAreaWidth;
      if (viewMode === "burger") {
        const burger = document.createElement("span");
        burger.innerHTML = "☰"; // ☰
        burger.style.cssText = "position: absolute; left: 8px; top: 8px; font-size: 18px; color: #555; cursor: pointer; z-index: 2;";
        handleEl.appendChild(burger);
        burger.addEventListener("click", (e) => {
          e.stopPropagation();
          openSidePanel(record, currentOptions);
        });
        cardEl.style.cursor = "default";
      } else {
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", () => {
          openSidePanel(record, currentOptions);
        });
      }

      // 2.2.3) Hover effect
      if (styling.selectedCard?.enabled) {
        cardEl.addEventListener("mouseenter", () => {
          cardEl.style.transform = `scale(${styling.selectedCard.scale})`;
          cardEl.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)";
        });
        cardEl.addEventListener("mouseleave", () => {
          cardEl.style.transform = "scale(1)";
          cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
        });
      }

      // 2.2.4) Card Title Top Bar
      const titleFields = layout.filter(f => f.style?.isTitleField);
      if (styling.cardTitleTopBarEnabled && titleFields.length > 0) {
        const topBarEl = document.createElement("div");
        topBarEl.style.gridRow = "1 / span 1";
        topBarEl.style.gridColumn = `1 / span ${NUM_COLS}`;
        topBarEl.style.padding = "4px 8px";
        topBarEl.style.display = "flex";
        topBarEl.style.alignItems = "center";
        topBarEl.style.gap = "16px";
        topBarEl.style.background = resolveColor(styling.cardTitleTopBarMode, styling.cardTitleTopBarSolidColor, null, styling.cardTitleTopBarField);
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
            lblEl.textContent = f.colId;
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

      // 2.2.5) Render all other fields in the grid
      layout.forEach(f => {
        const fieldStyle = { ...DEFAULT_FIELD_STYLE, ...f.style };
        if (!record.hasOwnProperty(f.colId)) return;
        if (styling.cardTitleTopBarEnabled && fieldStyle.isTitleField) return; // Skip if already in top bar

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
            labelEl.textContent = f.colId;
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
  
  // Placeholder action handler. This will be enhanced in Phase III.
  function openSidePanel(record, options) {
    console.log("ACTION: Open side panel for record:", record);
    console.log("ACTION: Drawer config to use:", options?.sidePanel?.drawerConfigId);
    // In Phase III, this will call:
    // DrawerComponent.openDrawer(record.id, options.sidePanel.drawerConfigId);
  }

  // Helper to resolve color based on configuration mode.
  function resolveColor(mode, solidColor, gradient, field) {
    // In this simplified version, we only handle solid colors.
    // The logic for 'conditional' mode would be implemented here in the future.
    return solidColor;
  }

  //--------------------------------------------------------------------
  // 4) Public API
  // - Only 'renderCards' is exposed.
  //--------------------------------------------------------------------
  return {
    renderCards
  };
})();