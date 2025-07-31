/*******************************************************************
 * CardSystem: A self-contained module that:
 *   - Renders "cards" using a 10-column grid layout
 *   - Has a config UI with Styling, FieldsLayout, Side Panel tabs
 *   - Applies styling for modern cards with handle on the left side
 *   - Respects "burger" or "click" view modes
 *   - Includes expanded styling: background as solid/gradient/field,
 *     card color as solid/gradient/field, card border thickness & color,
 *     card title top bar, handle width, etc.
 *******************************************************************/
const CardSystem = (() => {
  //--------------------------------------------------------------------
  // 1) Internal State + Defaults
  //--------------------------------------------------------------------
  let _fields = [];           // Layout definition

  // Field-specific styling defaults
  const DEFAULT_FIELD_STYLE = {
    labelVisible: true,
    labelPosition: 'above', // 'above' or 'left'
    labelFont: 'inherit',
    labelFontSize: 'inherit',
    labelColor: 'inherit',
    labelOutline: false,
    labelOutlineColor: '#ffffff',
    dataJustify: 'left', // 'left', 'center', 'right'
    heightLimited: false,
    maxHeightRows: 1,
    isTitleField: false // if true, it may go to top bar if top bar is enabled
  };

  // Expanded styling defaults. 
  let _styling = {
    // Widget background
    widgetBackgroundMode: "solid",          // 'solid' | 'gradient' | 'conditional'
    widgetBackgroundSolidColor: "#f9f9f9",
    widgetBackgroundGradient: null,         // placeholder storage
    widgetBackgroundField: null,            // field name if conditional
    
    // Cards background
    cardsColorMode: "solid",                // 'solid' | 'gradient' | 'conditional'
    cardsColorSolidColor: "#ffffff",
    cardsColorGradient: null,
    cardsColorField: null,
    
    // Card border
    cardBorderThickness: 0,                 // px
    cardBorderMode: "solid",                // 'solid' | 'conditional'
    cardBorderSolidColor: "#cccccc",
    cardBorderField: null,                  // if conditional, use white
    
    // Card Title (non-top-bar) -- styling if user sets isTitleField but no top bar
    cardTitleFontColor: "#000000",
    cardTitleFontStyle: "Calibri",
    cardTitleFontSize: "20px",
    
    // Card title top bar
    cardTitleTopBarEnabled: false,
    cardTitleTopBarMode: "solid",           // 'solid' | 'gradient' | 'conditional'
    cardTitleTopBarSolidColor: "#dddddd",
    cardTitleTopBarGradient: null,
    cardTitleTopBarField: null,

    // UPDATED: separate label/data styling for top bar
    cardTitleTopBarLabelFontColor: "#000000",
    cardTitleTopBarLabelFontStyle: "Calibri",
    cardTitleTopBarLabelFontSize: "16px",
    cardTitleTopBarDataFontColor: "#333333",
    cardTitleTopBarDataFontStyle: "Calibri",
    cardTitleTopBarDataFontSize: "16px",
    
    // Handle area
    handleAreaWidth: "8px",
    handleAreaMode: "solid",                // 'solid' | 'gradient' | 'conditional'
    handleAreaSolidColor: "#40E0D0",
    handleAreaGradient: null,
    handleAreaField: null,
    
    // Widget layout spacing
    widgetPadding: "10px",
    cardsSpacing: "15px",

    // Selected card hover effect
    selectedCard: {
      enabled: false,
      scale: 1.05,
      colorEffect: "none" 
    }
  };

  let _sidePanel = { size: "25%" };   // example default
  let _viewMode  = "click";          // 'click' or 'burger'

  // For the layout-based config
  const DEFAULT_NUM_ROWS = 1;
  const NUM_COLS = 10;          // Always 10 columns
  const CONFIG_WIDTH = 700;     // width of the config UI grid
  const COL_WIDTH = CONFIG_WIDTH / NUM_COLS;

  // Track if config UI is open
  let _configOpen = false;
  let _configOverlay = null;
  let _configModal = null;

  // Track field style popup
  let _fieldStylePopup = null;
  let _currentFieldStyle = null;
  let _currentFieldId = null;

  //--------------------------------------------------------------------
  // 2) Public init(...) - Called with saved fields, styling, sidePanel, etc.
  //--------------------------------------------------------------------
  function init(fields, styling, sidePanel, viewMode) {
    _fields = Array.isArray(fields) ? fields : [];
    
    // Initialize field styles if not present
    _fields.forEach(field => {
      if (!field.style) {
        field.style = {...DEFAULT_FIELD_STYLE};
      }
    });
    
    if (styling) {
      // Merge with defaults (handle nested objects carefully)
      _styling = {
        ..._styling,
        ...styling,
        selectedCard: {
          ..._styling.selectedCard,
          ...(styling.selectedCard || {})
        }
      };
    }
    if (sidePanel) {
      _sidePanel = { ..._sidePanel, ...sidePanel };
    }
    if (viewMode) {
      _viewMode = (viewMode === "burger") ? "burger" : "click";
    }
  }

  //--------------------------------------------------------------------
  // 3) Public renderCards(container, records, options)
  //--------------------------------------------------------------------
  async function renderCards(container, records, options) {
    // If the user passes 'options', we might re-init some styling or fields
    if (options?.styling) {
      _styling = {
        ..._styling,
        ...options.styling,
        selectedCard: {
          ..._styling.selectedCard,
          ...(options.styling.selectedCard || {})
        }
      };
    }
    if (options?.sidePanel) {
      _sidePanel = { ..._sidePanel, ...options.sidePanel };
    }
    if (options?.layout) {
      _fields = options.layout;
      // Initialize field styles if not present
      _fields.forEach(field => {
        if (!field.style) {
          field.style = {...DEFAULT_FIELD_STYLE};
        }
      });
    }
    if (options?.viewMode) {
      _viewMode = options.viewMode;
    }

    // Cache records so config UI can use them if needed
    window._recentRecords = records;

    // Basic checks
    container.innerHTML = "";
    if (!records || !records.length) {
      container.textContent = "No records found.";
      return;
    }

    // 3.1) Apply widget-level styling
    const widgetBg = resolveColor(
      _styling.widgetBackgroundMode,
      _styling.widgetBackgroundSolidColor,
      _styling.widgetBackgroundGradient,
      _styling.widgetBackgroundField
    );
    container.style.background = widgetBg;  // Could be solid or placeholder gradient
    container.style.padding = _styling.widgetPadding;

    // 3.2) Read how many rows from options, default if missing
    const numRows = options?.numRows ?? DEFAULT_NUM_ROWS;

    // 3.3) For each record, create a "Card"
    records.forEach((record, idx) => {
      const cardEl = document.createElement("div");
      cardEl.className = "cs-card";
      // Card's base styling
      cardEl.style.display = "grid";
      cardEl.style.gridTemplateRows = `repeat(${numRows}, auto)`;
      cardEl.style.gridTemplateColumns = `repeat(${NUM_COLS}, 1fr)`;
      cardEl.style.gap = "4px";

      // Card background
      const cardBg = resolveColor(
        _styling.cardsColorMode,
        _styling.cardsColorSolidColor,
        _styling.cardsColorGradient,
        _styling.cardsColorField
      );
      cardEl.style.background = cardBg;

      cardEl.style.marginBottom = _styling.cardsSpacing;
      cardEl.style.borderRadius = "8px";
      cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
      cardEl.style.position = "relative";
      cardEl.style.minHeight = "60px";
      cardEl.style.transition = "all 0.2s ease-in-out";

      // Card border (thickness + color)
      if (_styling.cardBorderThickness > 0) {
        const borderCol = (_styling.cardBorderMode === "conditional")
          ? "#ffffff" // if user picked a field, we do white (placeholder)
          : _styling.cardBorderSolidColor;
        cardEl.style.border = `${_styling.cardBorderThickness}px solid ${borderCol}`;
      } else {
        cardEl.style.border = "none";
      }

      // 3.3.1) We *always* create a handle area. If viewMode=burger, we place the burger icon in it.
      const handleEl = document.createElement("div");
      handleEl.style.position = "absolute";
      handleEl.style.left = "0";
      handleEl.style.top = "0";
      handleEl.style.bottom = "0";
      handleEl.style.width = _styling.handleAreaWidth;
      
      const handleColor = resolveColor(
        _styling.handleAreaMode,
        _styling.handleAreaSolidColor,
        _styling.handleAreaGradient,
        _styling.handleAreaField
      );
      handleEl.style.background = handleColor;
      handleEl.style.borderTopLeftRadius = "8px";
      handleEl.style.borderBottomLeftRadius = "8px";
      handleEl.style.zIndex = "1"; // Ensure it's above the card
      cardEl.appendChild(handleEl);

      // If burger mode, place a burger icon on that handle
      if (_viewMode === "burger") {
        const burger = document.createElement("span");
        burger.innerHTML = "&#9776;"; // ☰
        burger.style.position = "absolute";
        burger.style.left = "8px";
        burger.style.top = "8px";
        burger.style.fontSize = "18px";
        burger.style.color = "#555";
        burger.style.cursor = "pointer";
        handleEl.appendChild(burger);

        // If user clicks the burger, open side panel
        burger.addEventListener("click", (e) => {
          e.stopPropagation();
          openSidePanel(record);
        });

        // We will NOT make the entire card clickable in burger mode:
        cardEl.style.paddingLeft = _styling.handleAreaWidth;
        cardEl.style.cursor = "default";
      } else {
        // If click mode, the entire card is clickable
        cardEl.style.paddingLeft = _styling.handleAreaWidth;
        cardEl.style.position = "relative";
        cardEl.style.cursor = "pointer";
        cardEl.addEventListener("click", () => {
          openSidePanel(record);
        });
      }

      // 3.3.2) Hover effect if "selectedCard" enabled
      if (_styling.selectedCard?.enabled) {
        cardEl.addEventListener("mouseenter", () => {
          cardEl.style.transform = `scale(${_styling.selectedCard.scale})`;
          cardEl.style.boxShadow = "0 6px 12px rgba(0,0,0,0.2)";
        });
        cardEl.addEventListener("mouseleave", () => {
          cardEl.style.transform = "scale(1)";
          cardEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        });
      }

      // 3.3.3) If we have a "Card Title Top Bar" enabled, create that region:
      let topBarEl = null;
      let titleFields = _fields.filter(f => f.style?.isTitleField);
      if (_styling.cardTitleTopBarEnabled && titleFields.length > 0) {
        topBarEl = document.createElement("div");
        topBarEl.style.gridRow = "1 / span 1";      
        topBarEl.style.gridColumn = `1 / span ${NUM_COLS}`;
        topBarEl.style.padding = "4px 8px";
        topBarEl.style.display = "flex";
        topBarEl.style.alignItems = "center";
        topBarEl.style.gap = "16px";  // so multiple title fields line up horizontally
        
        const topBarColor = resolveColor(
          _styling.cardTitleTopBarMode,
          _styling.cardTitleTopBarSolidColor,
          _styling.cardTitleTopBarGradient,
          _styling.cardTitleTopBarField
        );
        topBarEl.style.background = topBarColor;
        topBarEl.style.borderTopLeftRadius = "8px";
        topBarEl.style.borderTopRightRadius = "8px";
        
        cardEl.appendChild(topBarEl);

        // For each title field, place label/data in that top bar
        titleFields.forEach(f => {
          const colId = f.colId;
          const val = (record[colId] == null ? "" : String(record[colId]));

          // Build a small container for label & data
          const tContainer = document.createElement("div");
          tContainer.style.display = "flex";
          tContainer.style.flexDirection = (f.style?.labelPosition === 'left' ? "row" : "column");
          tContainer.style.gap = "4px";

          if (f.style?.labelVisible) {
            const lblEl = document.createElement("div");
            lblEl.textContent = colId;
            lblEl.style.fontFamily = _styling.cardTitleTopBarLabelFontStyle;
            lblEl.style.fontSize   = _styling.cardTitleTopBarLabelFontSize;
            lblEl.style.color      = _styling.cardTitleTopBarLabelFontColor;
            tContainer.appendChild(lblEl);
          }
          
          const dataEl = document.createElement("div");
          dataEl.textContent = val;
          dataEl.style.fontFamily = _styling.cardTitleTopBarDataFontStyle;
          dataEl.style.fontSize   = _styling.cardTitleTopBarDataFontSize;
          dataEl.style.color      = _styling.cardTitleTopBarDataFontColor;
          dataEl.style.whiteSpace = "nowrap";
          tContainer.appendChild(dataEl);

          topBarEl.appendChild(tContainer);
        });
      }

      // 3.3.4) Now place the **non-title** fields (or if top bar disabled, place all) in the grid.
      _fields.forEach(f => {
        const { colId, row, col, colSpan = 1, style = {...DEFAULT_FIELD_STYLE} } = f;
        // If the record has that colId
        if (!record.hasOwnProperty(colId)) return;

        // If top bar is enabled and this field is a "title field", skip it
        // because we've already rendered it in the top bar.
        if (_styling.cardTitleTopBarEnabled && style.isTitleField) {
          return;
        }

        // Otherwise, place it in the grid if row is valid
        if (row >= 0 && row < numRows) {
          const fieldBox = document.createElement("div");
          fieldBox.style.gridRow = `${row + 1}`;
          fieldBox.style.gridColumn = `${col + 1} / ${col + 1 + colSpan}`;
          fieldBox.style.padding = "4px";
          fieldBox.style.border = "none";
          
          // Set flex direction based on label position
          if (style.labelPosition === 'left') {
            fieldBox.style.display = "flex";
            fieldBox.style.alignItems = "center";
            fieldBox.style.gap = "8px";
          } else {
            fieldBox.style.display = "flex";
            fieldBox.style.flexDirection = "column";
          }

          // Title styling (for the non-top-bar case, if it's a title field)
          const labelEl = document.createElement("div");
          if (style.labelVisible) {
            labelEl.textContent = colId;
            
            if (style.isTitleField && !_styling.cardTitleTopBarEnabled) {
              // apply the "cardTitleFont..." from styling
              labelEl.style.fontWeight = "bold";
              labelEl.style.color = _styling.cardTitleFontColor;
              labelEl.style.fontSize = _styling.cardTitleFontSize;
              labelEl.style.fontFamily = _styling.cardTitleFontStyle;
            } else {
              // normal label styling
              labelEl.style.fontFamily = style.labelFont;
              labelEl.style.fontSize = style.labelFontSize;
              labelEl.style.color = style.labelColor;
              if (style.labelOutline) {
                labelEl.style.textShadow = `-1px -1px 0 ${style.labelOutlineColor},  
                                           1px -1px 0 ${style.labelOutlineColor},
                                          -1px 1px 0 ${style.labelOutlineColor},
                                           1px 1px 0 ${style.labelOutlineColor}`;
              }
            }
          } else {
            labelEl.style.display = "none";
          }

          // Value element
          const valueEl = document.createElement("div");
          valueEl.style.marginTop = style.labelPosition === 'above' ? "2px" : "0";
          valueEl.style.color = "#333";
          
          // Apply text justification
          valueEl.style.textAlign = style.dataJustify;
          
          // Handle height limiting
          if (style.heightLimited) {
            valueEl.style.maxHeight = `${style.maxHeightRows * 1.2}em`; // Approx line-height
            valueEl.style.overflow = "hidden";
            valueEl.style.textOverflow = "ellipsis";
            valueEl.style.display = "-webkit-box";
            valueEl.style.webkitLineClamp = style.maxHeightRows;
            valueEl.style.webkitBoxOrient = "vertical";
          }
          
          valueEl.textContent = (record[colId] == null ? "" : String(record[colId]));

          // We do NOT re-render on fieldBox click now, to avoid real-time confusion
          // If you want the style popup in the final widget, you’d show it differently.

          // Add elements to box
          if (style.labelVisible) {
            fieldBox.appendChild(labelEl);
          }
          fieldBox.appendChild(valueEl);

          cardEl.appendChild(fieldBox);
        }
      });

      container.appendChild(cardEl);
    });

    // If the configure button isn't there, add it
    if (!container.querySelector("#cs-configure-btn")) {
      const cfgBtn = document.createElement("button");
      cfgBtn.id = "cs-configure-btn";
      cfgBtn.textContent = "Configure Layout";
      cfgBtn.style.marginBottom = "12px";
      cfgBtn.onclick = openConfig;
      container.prepend(cfgBtn);
    }
  }

  // UPDATED: Placeholder side panel logic
  function openSidePanel(record) {
    // In your real usage, you can create a side panel or something else:
    console.log("Open side panel for record:", record);
    // ... show side panel ...
  }

  //--------------------------------------------------------------------
  // A small helper to interpret user's choice for color/gradient/field
  //--------------------------------------------------------------------
  function resolveColor(mode, solid, gradient, field) {
    if (mode === "solid") {
      return solid;
    } else if (mode === "gradient") {
      // Just a placeholder; in reality you might store gradient details
      return "linear-gradient(45deg, #ffffff, #cccccc)";
    } else if (mode === "conditional") {
      // We ignore which field was selected and just return white
      return "#ffffff";
    }
    // Default fallback
    return solid;
  }

  //--------------------------------------------------------------------
  // 4) The Config UI: 3 tabs: "Styling", "FieldsLayout", "SidePanel"
  //--------------------------------------------------------------------
  async function openConfig() {
    if (_configOpen) return;
    _configOpen = true;

    // Grab the latest options from Grist
    const options = await grist.getOptions() || {};
    const layout = Array.isArray(options.layout) ? options.layout.slice() : _fields.slice();
    const numRows = options.numRows ?? DEFAULT_NUM_ROWS;

    // Create overlay
    _configOverlay = document.createElement("div");
    Object.assign(_configOverlay.style, {
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)", zIndex: 9999
    });

    // Create modal
    _configModal = document.createElement("div");
    Object.assign(_configModal.style, {
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: "900px", height: "600px",
      background: "#fff", border: "1px solid #ccc",
      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
      display: "flex", flexDirection: "column"
    });

    // Titlebar
    const header = document.createElement("div");
    header.style.padding = "8px 12px";
    header.style.background = "#eee";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";

    const hTitle = document.createElement("div");
    hTitle.textContent = "CardSystem Configuration";
    hTitle.style.fontSize = "16px";
    hTitle.style.fontWeight = "bold";
    header.appendChild(hTitle);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => closeConfig();
    header.appendChild(closeBtn);
    _configModal.appendChild(header);

    // Tabs row
    const tabsRow = document.createElement("div");
    tabsRow.style.display = "flex";
    tabsRow.style.borderBottom = "2px solid #666";
    let tabSty = createTabButton("Styling", "sty");
    let tabFld = createTabButton("FieldsLayout", "fld");
    let tabSid = createTabButton("Side Panel", "sid");
    [tabSty, tabFld, tabSid].forEach(t => tabsRow.appendChild(t));
    _configModal.appendChild(tabsRow);

    // Main content area
    const contentArea = document.createElement("div");
    contentArea.style.flex = "1";
    contentArea.style.overflow = "auto";
    contentArea.style.padding = "10px";
    contentArea.id = "card-config-contents";
    _configModal.appendChild(contentArea);

    // Bottom bar with "Save" button
    const bottomBar = document.createElement("div");
    bottomBar.style.borderTop = "1px solid #ccc";
    bottomBar.style.padding = "8px 12px";
    bottomBar.style.textAlign = "right";
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save & Apply";
    saveBtn.style.fontWeight = "bold";
    saveBtn.onclick = () => onClickSave(options, layout);
    bottomBar.appendChild(saveBtn);
    _configModal.appendChild(bottomBar);

    // Put modal in overlay
    _configOverlay.appendChild(_configModal);
    document.body.appendChild(_configOverlay);

    // Build the three tab contents
    buildStylingTab(contentArea);
    buildFieldsLayoutTab(contentArea, layout, numRows);
    buildSidePanelTab(contentArea);

    // Show the first tab by default
    switchTab("sty");
  }

  // Create a simple tab button
  function createTabButton(label, tabId) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.flex = "1";
    btn.style.padding = "8px";
    btn.style.border = "none";
    btn.style.borderBottom = "3px solid transparent";
    btn.style.background = "#ddd";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => switchTab(tabId));
    btn.dataset.tabId = tabId;
    return btn;
  }

  function switchTab(tabId) {
    const contentDiv = document.getElementById("card-config-contents");
    if (!contentDiv) return;
    const allTabs = contentDiv.querySelectorAll("[data-tab-section]");
    allTabs.forEach(t => (t.style.display = "none"));

    // Deactivate tab buttons
    const buttons = _configModal.querySelectorAll("[data-tab-id]");
    buttons.forEach(b => {
      b.style.background = "#ddd";
      b.style.borderBottomColor = "transparent";
    });

    // Show the chosen tab
    const newActive = contentDiv.querySelector(`[data-tab-section='${tabId}']`);
    if (newActive) newActive.style.display = "block";

    // Activate the chosen button
    const activeBtn = _configModal.querySelector(`[data-tab-id='${tabId}']`);
    if (activeBtn) {
      activeBtn.style.background = "#fff";
      // use handleArea color as an accent
      activeBtn.style.borderBottomColor = _styling.handleAreaSolidColor; 
    }
  }

  //--------------------------------------------------------------------
  // STYLING TAB
  //--------------------------------------------------------------------
  let stWidgetBgMode, stWidgetBgColor, stWidgetBgGradientBtn, stWidgetBgField;
  let stCardsColorMode, stCardsColor, stCardsGradientBtn, stCardsColorField;
  let stCardBorderThickness, stCardBorderMode, stCardBorderColor, stCardBorderField;

  let stTitleFontColor, stTitleFontStyle, stTitleFontSize;
  let stTopBarEnabled, stTopBarMode, stTopBarColor, stTopBarGradientBtn, stTopBarField;

  // UPDATED: new inputs for top bar label/data styling
  let stTopBarLabelColor, stTopBarLabelFontStyle, stTopBarLabelFontSize;
  let stTopBarDataColor,  stTopBarDataFontStyle, stTopBarDataFontSize;

  let stHandleWidth, stHandleMode, stHandleColor, stHandleGradientBtn, stHandleField;

  let stWidgetPadding, stCardsSpacing;
  let stSelEnabled, stSelScale, stSelColorEffect;

  function buildStylingTab(contentArea) {
    const tabEl = document.createElement("div");
    tabEl.dataset.tabSection = "sty";
    tabEl.style.display = "none";

    // We'll build out sections for each grouping
    tabEl.innerHTML = `
      <h3>Styling Options</h3>

      <!-- Widget Background -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Widget Background</b></legend>
        <label><input type="radio" name="bgmode" value="solid"/> Solid </label>
        <input type="color" id="cs-st-bgcolor" />
        <label><input type="radio" name="bgmode" value="gradient"/> Gradient </label>
        <button id="cs-st-bg-gradient-btn">Edit Gradient</button>
        <label><input type="radio" name="bgmode" value="conditional"/> Conditional (field)</label>
        <select id="cs-st-bgfield"><option value="">-- choose field --</option></select>
      </fieldset>

      <!-- Cards Color -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Cards Color</b></legend>
        <label><input type="radio" name="cardscolormode" value="solid"/> Solid </label>
        <input type="color" id="cs-st-cardcolor" />
        <label><input type="radio" name="cardscolormode" value="gradient"/> Gradient </label>
        <button id="cs-st-cards-gradient-btn">Edit Gradient</button>
        <label><input type="radio" name="cardscolormode" value="conditional"/> Conditional (field)</label>
        <select id="cs-st-cardscolorfield"><option value="">-- choose field --</option></select>
      </fieldset>

      <!-- Card Border -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Card Border</b></legend>
        <div>Thickness (px): <input type="number" id="cs-st-border-thickness" min="0" style="width:60px"/></div>
        <label><input type="radio" name="bordermode" value="solid"/> Solid color </label>
        <input type="color" id="cs-st-border-color" />
        <label><input type="radio" name="bordermode" value="conditional"/> Conditional (field)</label>
        <select id="cs-st-border-field"><option value="">-- choose field --</option></select>
      </fieldset>

      <!-- Card Title (non-top-bar) -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Card Title (no Top Bar)</b></legend>
        <div>Font Color: <input type="color" id="cs-st-titlecolor" /></div>
        <div>Font Style:
          <select id="cs-st-titlefont">
            <option>Calibri</option>
            <option>Arial</option>
            <option>Times New Roman</option>
            <option>Verdana</option>
            <option>Georgia</option>
          </select>
        </div>
        <div>Font Size (px): <input type="number" id="cs-st-titlesize" min="8" style="width:60px"/></div>
      </fieldset>

      <!-- Card Title Top Bar -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Card Title Top Bar</b></legend>
        <div><input type="checkbox" id="cs-st-topbar-enabled" /> Enable Top Bar</div>
        <label><input type="radio" name="topbarmode" value="solid"/> Solid </label>
        <input type="color" id="cs-st-topbar-color" />
        <label><input type="radio" name="topbarmode" value="gradient"/> Gradient </label>
        <button id="cs-st-topbar-gradient-btn">Edit Gradient</button>
        <label><input type="radio" name="topbarmode" value="conditional"/> Conditional (field)</label>
        <select id="cs-st-topbar-field"><option value="">-- choose field --</option></select>

        <div style="margin:6px 0 0;"><b>Top Bar Label Styling</b></div>
        <div>Label Color: <input type="color" id="cs-st-topbar-lblcolor" /></div>
        <div>Label Font:
          <select id="cs-st-topbar-lblfont">
            <option>Calibri</option>
            <option>Arial</option>
            <option>Times New Roman</option>
            <option>Verdana</option>
            <option>Georgia</option>
          </select>
        </div>
        <div>Label Font Size (px): <input type="number" id="cs-st-topbar-lblsize" min="8" style="width:60px"/></div>

        <div style="margin:6px 0 0;"><b>Top Bar Data Styling</b></div>
        <div>Data Color: <input type="color" id="cs-st-topbar-datacolor" /></div>
        <div>Data Font:
          <select id="cs-st-topbar-datafont">
            <option>Calibri</option>
            <option>Arial</option>
            <option>Times New Roman</option>
            <option>Verdana</option>
            <option>Georgia</option>
          </select>
        </div>
        <div>Data Font Size (px): <input type="number" id="cs-st-topbar-datasize" min="8" style="width:60px"/></div>
      </fieldset>

      <!-- Handle Area -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Handle Area</b></legend>
        <div>Width (px): <input type="number" id="cs-st-handle-width" min="1" style="width:60px"/></div>
        <label><input type="radio" name="handlemode" value="solid"/> Solid </label>
        <input type="color" id="cs-st-handle-color" />
        <label><input type="radio" name="handlemode" value="gradient"/> Gradient </label>
        <button id="cs-st-handle-gradient-btn">Edit Gradient</button>
        <label><input type="radio" name="handlemode" value="conditional"/> Conditional (field)</label>
        <select id="cs-st-handle-field"><option value="">-- choose field --</option></select>
      </fieldset>

      <!-- Widget Padding & Card Spacing -->
      <fieldset style="margin-bottom:10px;">
        <legend><b>Layout Spacing</b></legend>
        <div>Widget Padding (px): <input type="number" id="cs-st-padding" min="0" style="width:60px" /></div>
        <div>Space Between Cards (px): <input type="number" id="cs-st-spacing" min="0" style="width:60px" /></div>
      </fieldset>

      <hr/>
      <h4>Selected Card Hover Effect</h4>
      <div style="display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:6px;align-items:center;">
        <label>Enable Effect:</label> <input type="checkbox" id="cs-st-sel-enabled" />
        <label>Scale (% above normal):</label> <input type="number" id="cs-st-sel-scale" min="0" max="100" style="width:60px" />
        <label>Color Shift:</label>
        <select id="cs-st-sel-color" >
          <option value="none">No Change</option>
          <option value="brighter-5">5% Brighter</option>
          <option value="brighter-10">10% Brighter</option>
          <option value="brighter-15">15% Brighter</option>
          <option value="darker-5">5% Darker</option>
          <option value="darker-10">10% Darker</option>
          <option value="darker-15">15% Darker</option>
        </select>
      </div>
    `;

    contentArea.appendChild(tabEl);

    // Collect references
    stWidgetBgMode          = tabEl.querySelectorAll("input[name='bgmode']");
    stWidgetBgColor         = tabEl.querySelector("#cs-st-bgcolor");
    stWidgetBgGradientBtn   = tabEl.querySelector("#cs-st-bg-gradient-btn");
    stWidgetBgField         = tabEl.querySelector("#cs-st-bgfield");

    stCardsColorMode        = tabEl.querySelectorAll("input[name='cardscolormode']");
    stCardsColor            = tabEl.querySelector("#cs-st-cardcolor");
    stCardsGradientBtn      = tabEl.querySelector("#cs-st-cards-gradient-btn");
    stCardsColorField       = tabEl.querySelector("#cs-st-cardscolorfield");

    stCardBorderThickness   = tabEl.querySelector("#cs-st-border-thickness");
    stCardBorderMode        = tabEl.querySelectorAll("input[name='bordermode']");
    stCardBorderColor       = tabEl.querySelector("#cs-st-border-color");
    stCardBorderField       = tabEl.querySelector("#cs-st-border-field");

    stTitleFontColor        = tabEl.querySelector("#cs-st-titlecolor");
    stTitleFontStyle        = tabEl.querySelector("#cs-st-titlefont");
    stTitleFontSize         = tabEl.querySelector("#cs-st-titlesize");

    stTopBarEnabled         = tabEl.querySelector("#cs-st-topbar-enabled");
    stTopBarMode            = tabEl.querySelectorAll("input[name='topbarmode']");
    stTopBarColor           = tabEl.querySelector("#cs-st-topbar-color");
    stTopBarGradientBtn     = tabEl.querySelector("#cs-st-topbar-gradient-btn");
    stTopBarField           = tabEl.querySelector("#cs-st-topbar-field");

    stTopBarLabelColor      = tabEl.querySelector("#cs-st-topbar-lblcolor");
    stTopBarLabelFontStyle  = tabEl.querySelector("#cs-st-topbar-lblfont");
    stTopBarLabelFontSize   = tabEl.querySelector("#cs-st-topbar-lblsize");

    stTopBarDataColor       = tabEl.querySelector("#cs-st-topbar-datacolor");
    stTopBarDataFontStyle   = tabEl.querySelector("#cs-st-topbar-datafont");
    stTopBarDataFontSize    = tabEl.querySelector("#cs-st-topbar-datasize");

    stHandleWidth           = tabEl.querySelector("#cs-st-handle-width");
    stHandleMode            = tabEl.querySelectorAll("input[name='handlemode']");
    stHandleColor           = tabEl.querySelector("#cs-st-handle-color");
    stHandleGradientBtn     = tabEl.querySelector("#cs-st-handle-gradient-btn");
    stHandleField           = tabEl.querySelector("#cs-st-handle-field");

    stWidgetPadding         = tabEl.querySelector("#cs-st-padding");
    stCardsSpacing          = tabEl.querySelector("#cs-st-spacing");

    stSelEnabled            = tabEl.querySelector("#cs-st-sel-enabled");
    stSelScale              = tabEl.querySelector("#cs-st-sel-scale");
    stSelColorEffect        = tabEl.querySelector("#cs-st-sel-color");

    // Fill the inputs from _styling
    // Widget background
    [...stWidgetBgMode].forEach(r => { r.checked = (r.value === _styling.widgetBackgroundMode); });
    stWidgetBgColor.value = _styling.widgetBackgroundSolidColor || "#f9f9f9";
    stWidgetBgField.value = _styling.widgetBackgroundField || "";

    // Cards color
    [...stCardsColorMode].forEach(r => { r.checked = (r.value === _styling.cardsColorMode); });
    stCardsColor.value = _styling.cardsColorSolidColor || "#ffffff";
    stCardsColorField.value = _styling.cardsColorField || "";

    // Card border
    stCardBorderThickness.value = _styling.cardBorderThickness || 0;
    [...stCardBorderMode].forEach(r => { r.checked = (r.value === _styling.cardBorderMode); });
    stCardBorderColor.value = _styling.cardBorderSolidColor || "#cccccc";
    stCardBorderField.value = _styling.cardBorderField || "";

    // Title (non-top-bar)
    stTitleFontColor.value = _styling.cardTitleFontColor || "#000000";
    stTitleFontStyle.value = _styling.cardTitleFontStyle || "Calibri";
    stTitleFontSize.value  = parseInt(_styling.cardTitleFontSize, 10) || 20;

    // Top bar
    stTopBarEnabled.checked = !!_styling.cardTitleTopBarEnabled;
    [...stTopBarMode].forEach(r => { r.checked = (r.value === _styling.cardTitleTopBarMode); });
    stTopBarColor.value = _styling.cardTitleTopBarSolidColor || "#dddddd";
    stTopBarField.value = _styling.cardTitleTopBarField || "";

    // Top bar label
    stTopBarLabelColor.value     = _styling.cardTitleTopBarLabelFontColor || "#000000";
    stTopBarLabelFontStyle.value = _styling.cardTitleTopBarLabelFontStyle || "Calibri";
    stTopBarLabelFontSize.value  = parseInt(_styling.cardTitleTopBarLabelFontSize, 10) || 16;

    // Top bar data
    stTopBarDataColor.value      = _styling.cardTitleTopBarDataFontColor || "#333333";
    stTopBarDataFontStyle.value  = _styling.cardTitleTopBarDataFontStyle || "Calibri";
    stTopBarDataFontSize.value   = parseInt(_styling.cardTitleTopBarDataFontSize, 10) || 16;

    // Handle area
    stHandleWidth.value = parseInt(_styling.handleAreaWidth,10) || 8;
    [...stHandleMode].forEach(r => { r.checked = (r.value === _styling.handleAreaMode); });
    stHandleColor.value = _styling.handleAreaSolidColor || "#40E0D0";
    stHandleField.value = _styling.handleAreaField || "";

    // Layout spacing
    stWidgetPadding.value = parseInt(_styling.widgetPadding, 10) || 10;
    stCardsSpacing.value  = parseInt(_styling.cardsSpacing, 10) || 15;

    // Selected card effect
    stSelEnabled.checked = !!_styling.selectedCard?.enabled;
    stSelScale.value = Math.round(((_styling.selectedCard?.scale || 1) - 1) * 100);
    stSelColorEffect.value = _styling.selectedCard?.colorEffect || "none";

    // For the gradient buttons: just open a placeholder
    stWidgetBgGradientBtn.addEventListener("click", () => alert("Open gradient editor placeholder for widget background"));
    stCardsGradientBtn.addEventListener("click", () => alert("Open gradient editor placeholder for cards background"));
    stTopBarGradientBtn.addEventListener("click", () => alert("Open gradient editor placeholder for top bar"));
    stHandleGradientBtn.addEventListener("click", () => alert("Open gradient editor placeholder for handle area"));

    // Fill "Conditional (field)" selects if we have known record fields
    if (window._recentRecords && window._recentRecords.length) {
      const allFields = Object.keys(window._recentRecords[0]).filter(f => f !== "id");
      populateFieldSelect(stWidgetBgField, allFields);
      populateFieldSelect(stCardsColorField, allFields);
      populateFieldSelect(stCardBorderField, allFields);
      populateFieldSelect(stTopBarField, allFields);
      populateFieldSelect(stHandleField, allFields);
    }
  }

  function populateFieldSelect(selectEl, fieldList) {
    // Keep the first placeholder
    while (selectEl.options.length > 1) {
      selectEl.remove(1);
    }
    fieldList.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      selectEl.appendChild(opt);
    });
  }

  //--------------------------------------------------------------------
  // FIELDS LAYOUT TAB
  //--------------------------------------------------------------------
  function buildFieldsLayoutTab(contentArea, layout, numRows) {
    const tabEl = document.createElement("div");
    tabEl.dataset.tabSection = "fld";
    tabEl.style.display = "none";
    tabEl.innerHTML = `
      <h3>Fields & Layout</h3>
      <div style="display: flex; gap: 10px; align-items:center;">
        <label>View Mode:</label>
        <label><input type="radio" name="cs-viewmode" id="cs-vm-click" value="click" /> Click Card</label>
        <label><input type="radio" name="cs-viewmode" id="cs-vm-burger" value="burger" /> Burger Icon</label>
        <span style="margin-left:20px;"></span>
        <label>Number of Rows:</label>
        <input type="number" id="cs-num-rows" value="${numRows}" min="1" max="20" style="width:60px;" />
      </div>
      <p style="margin-top:0;font-size:12px;">
        Drag fields onto the grid below. Each row is 700px wide with 10 columns (70px each).
        Grab the right edge of a placed field to expand it horizontally.
      </p>
      <div id="cs-layout-grid" style="border:1px solid #ccc; width:${CONFIG_WIDTH}px; height:auto; margin-bottom:8px; position:relative; background-image:linear-gradient(to right, #aaa 1px, transparent 1px); background-size:${COL_WIDTH}px 100%;"></div>
      <div style="border-top:1px solid #ccc; padding-top:8px;">
        <b>Available Fields (drag to grid):</b>
        <div id="cs-layout-fields" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>
      </div>
    `;
    contentArea.appendChild(tabEl);

    // Radio buttons for view mode
    const vmClick = tabEl.querySelector("#cs-vm-click");
    const vmBurger = tabEl.querySelector("#cs-vm-burger");
    if (_viewMode === "burger") {
      vmBurger.checked = true;
    } else {
      vmClick.checked = true;
    }

    // # of rows input
    const rowInput = tabEl.querySelector("#cs-num-rows");
    rowInput.addEventListener("change", () => {
      const n = parseInt(rowInput.value, 10) || 1;
      buildGridUI(tabEl.querySelector("#cs-layout-grid"), layout, n);
    });

    // Build the grid
    const gridEl = tabEl.querySelector("#cs-layout-grid");
    buildGridUI(gridEl, layout, numRows);

    // Build the available fields list
    const fieldsEl = tabEl.querySelector("#cs-layout-fields");
    buildAvailableFieldsList(fieldsEl, layout);
  }

  // Actually build the droppable row-by-row grid
  function buildGridUI(gridEl, layout, numRows) {
    gridEl.innerHTML = ""; // Clear

    for (let r = 0; r < numRows; r++) {
      const rowDiv = document.createElement("div");
      rowDiv.style.position = "relative";
      rowDiv.style.width = CONFIG_WIDTH + "px";
      rowDiv.style.height = "50px";
      rowDiv.style.borderBottom = "1px dashed #ccc";
      rowDiv.style.boxSizing = "border-box";
      rowDiv.dataset.rowIndex = String(r);

      rowDiv.addEventListener("dragover", e => { e.preventDefault(); });
      rowDiv.addEventListener("drop", e => {
        e.preventDefault();
        const colId = e.dataTransfer.getData("text/colid");
        if (!colId) return;
        const rect = rowDiv.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const col = Math.max(0, Math.min(NUM_COLS-1, Math.floor(localX / COL_WIDTH)));
        layout.push({ 
          colId, 
          row: r, 
          col, 
          colSpan: 2,
          style: {...DEFAULT_FIELD_STYLE}
        });
        removeFieldFromList(colId);
        buildGridUI(gridEl, layout, numRows);
      });

      // Render fields that belong to row r
      layout.filter(f => f.row === r).forEach(f => {
        const box = createFieldBoxInConfigUI(f, layout, numRows);
        rowDiv.appendChild(box);
      });

      gridEl.appendChild(rowDiv);
    }
  }

  // Build the draggable "field box" in the config UI
  function createFieldBoxInConfigUI(fieldDef, layout, numRows) {
    const colId = fieldDef.colId;
    const col = fieldDef.col ?? 0;
    const colSpan = fieldDef.colSpan ?? 2;
    const leftPx = col * COL_WIDTH;
    const widthPx = colSpan * COL_WIDTH;

    const box = document.createElement("div");
    box.textContent = colId;
    Object.assign(box.style, {
      position: "absolute",
      top: "4px",
      left: leftPx + "px",
      width: widthPx + "px",
      height: "42px",
      border: "1px solid #666",
      background: "#ddd",
      borderRadius: "4px",
      boxSizing: "border-box",
      padding: "4px",
      overflow: "hidden",
      cursor: "move",
      color: "#333"
    });

    // UPDATED: gear icon on the left
    const gearIcon = document.createElement("div");
    gearIcon.innerHTML = "⚙️";
    gearIcon.style.position = "absolute";
    gearIcon.style.left = "2px";
    gearIcon.style.top = "2px";
    gearIcon.style.cursor = "pointer";
    gearIcon.style.fontSize = "12px";
    gearIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      openFieldStylePopup(box, fieldDef);
    });
    box.appendChild(gearIcon);

    // UPDATED: X to remove
    const removeIcon = document.createElement("div");
    removeIcon.innerHTML = "✕";
    removeIcon.style.position = "absolute";
    removeIcon.style.left = "20px";
    removeIcon.style.top = "2px";
    removeIcon.style.cursor = "pointer";
    removeIcon.style.fontSize = "12px";
    removeIcon.style.color = "red";
    removeIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = layout.indexOf(fieldDef);
      if (idx >= 0) layout.splice(idx,1);
      // Rebuild grid
      const rowInput = _configModal.querySelector("#cs-num-rows");
      const nRows = parseInt(rowInput.value, 10) || DEFAULT_NUM_ROWS;
      buildGridUI(_configModal.querySelector("#cs-layout-grid"), layout, nRows);
      // Return field to available list
      const contentDiv = _configModal.querySelector("#card-config-contents");
      if (contentDiv) {
        const fieldsEl = contentDiv.querySelector("#cs-layout-fields");
        buildAvailableFieldsList(fieldsEl, layout);
      }
    });
    box.appendChild(removeIcon);

    // Make the box draggable
    box.draggable = true;
    box.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/colid", colId);
      const idx = layout.indexOf(fieldDef);
      if (idx >= 0) layout.splice(idx,1);
    });

    // Right handle for resizing
    const handle = document.createElement("div");
    Object.assign(handle.style, {
      position: "absolute",
      top: "0",
      right: "0",
      width: "6px",
      height: "100%",
      background: "#999",
      cursor: "ew-resize"
    });
    box.appendChild(handle);

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      box.draggable = false; // disable dragging while resizing

      const startX = e.clientX;
      const origW = parseFloat(box.style.width);
      let newWidth = origW;

      function onMouseMove(moveEvt) {
        moveEvt.preventDefault();
        let delta = moveEvt.clientX - startX;
        newWidth = origW + delta;
        if (newWidth < COL_WIDTH) newWidth = COL_WIDTH;
        if (newWidth > (COL_WIDTH * NUM_COLS - leftPx)) {
          newWidth = COL_WIDTH * NUM_COLS - leftPx;
        }
        box.style.width = newWidth + "px";
      }
      function onMouseUp(upEvt) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        // Calculate new colSpan
        let newSpan = Math.round(newWidth / COL_WIDTH);
        fieldDef.colSpan = Math.max(1, Math.min(NUM_COLS - fieldDef.col, newSpan));
        box.draggable = true; // re-enable dragging
        const gridContainer = _configModal.querySelector("#cs-layout-grid");
        const numRowsNow = parseInt(document.querySelector("#cs-num-rows").value, 10) || DEFAULT_NUM_ROWS;
        buildGridUI(gridContainer, layout, numRowsNow);
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
    return box;
  }

  // Build the "Available Fields" area for unplaced fields
  function buildAvailableFieldsList(container, layout) {
    container.innerHTML = "";
    let allCols = [];
    if (window._recentRecords && window._recentRecords.length) {
      allCols = Object.keys(window._recentRecords[0]).filter(c => c !== 'id');
    }
    // Also from _fields if colId not in the records
    _fields.forEach(f => {
      if (!allCols.includes(f.colId)) {
        allCols.push(f.colId);
      }
    });
    // Now exclude those already in layout
    const usedCols = layout.map(l => l.colId);
    const availableCols = allCols.filter(c => !usedCols.includes(c));

    if (!availableCols.length) {
      container.innerHTML = "<i style='color:#666'>All fields placed.</i>";
      return;
    }
    availableCols.forEach(colId => {
      const el = document.createElement("div");
      el.textContent = colId;
      el.setAttribute("data-colid", colId);
      Object.assign(el.style, {
        border: "1px solid #999", padding: "4px 8px",
        background: "#eee", cursor: "grab"
      });
      el.draggable = true;
      el.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/colid", colId);
      });
      container.appendChild(el);
    });
  }

  // Remove a field from the "Available Fields" UI
  function removeFieldFromList(colId) {
    const contentDiv = _configModal?.querySelector("#card-config-contents");
    if (!contentDiv) return;
    const availableArea = contentDiv.querySelector("#cs-layout-fields");
    if (!availableArea) return;
    const item = availableArea.querySelector(`[data-colid='${colId}']`);
    if (item) item.remove();
  }

  //--------------------------------------------------------------------
  // SIDE PANEL TAB
  //--------------------------------------------------------------------
  let spSizeSel;
  function buildSidePanelTab(contentArea) {
    const tabEl = document.createElement("div");
    tabEl.dataset.tabSection = "sid";
    tabEl.style.display = "none";
    tabEl.innerHTML = `
      <h3>Side Panel</h3>
      <p>Example side panel config if you want a separate details panel.</p>
      <div style="margin-bottom:8px;">
        <label>Size:</label>
        <select id="cs-sp-size">
          <option value="15%">15%</option>
          <option value="25%">25%</option>
          <option value="35%">35%</option>
          <option value="50%">50%</option>
        </select>
      </div>
    `;
    contentArea.appendChild(tabEl);

    spSizeSel = tabEl.querySelector("#cs-sp-size");
    spSizeSel.value = _sidePanel.size;
  }

  //--------------------------------------------------------------------
  // 5) The Field Style Popup (gear icon) - updates only in memory
  //--------------------------------------------------------------------
  function openFieldStylePopup(fieldElement, fieldDef) {
    if (_fieldStylePopup) {
      document.body.removeChild(_fieldStylePopup);
      _fieldStylePopup = null;
      return;
    }

    _currentFieldStyle = {...fieldDef.style};
    _currentFieldId = fieldDef.colId;

    // Create popup element
    _fieldStylePopup = document.createElement("div");
    _fieldStylePopup.style.position = "fixed";
    _fieldStylePopup.style.left = "50%";
    _fieldStylePopup.style.top = "50%";
    _fieldStylePopup.style.transform = "translate(-50%, -50%)";
    _fieldStylePopup.style.backgroundColor = "white";
    _fieldStylePopup.style.border = "1px solid #ccc";
    _fieldStylePopup.style.borderRadius = "8px";
    _fieldStylePopup.style.padding = "20px";
    _fieldStylePopup.style.zIndex = "10000";
    _fieldStylePopup.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
    _fieldStylePopup.style.width = "300px";

    // Field name display
    const fieldName = document.createElement("h3");
    fieldName.textContent = `Field: ${fieldDef.colId}`;
    fieldName.style.marginTop = "0";
    _fieldStylePopup.appendChild(fieldName);

    // Label visibility toggle
    const labelVisibleDiv = document.createElement("div");
    labelVisibleDiv.style.marginBottom = "10px";
    const labelVisibleLabel = document.createElement("label");
    labelVisibleLabel.style.display = "flex";
    labelVisibleLabel.style.alignItems = "center";
    labelVisibleLabel.style.gap = "8px";
    const labelVisibleCheck = document.createElement("input");
    labelVisibleCheck.type = "checkbox";
    labelVisibleCheck.checked = _currentFieldStyle.labelVisible;
    labelVisibleCheck.addEventListener("change", (e) => {
      _currentFieldStyle.labelVisible = e.target.checked;
    });
    labelVisibleLabel.appendChild(labelVisibleCheck);
    labelVisibleLabel.appendChild(document.createTextNode("Show Label"));
    labelVisibleDiv.appendChild(labelVisibleLabel);
    _fieldStylePopup.appendChild(labelVisibleDiv);

    // Label position
    const labelPositionDiv = document.createElement("div");
    labelPositionDiv.style.marginBottom = "10px";
    const labelPositionLabel = document.createElement("label");
    labelPositionLabel.textContent = "Label Position:";
    labelPositionLabel.style.display = "block";
    labelPositionLabel.style.marginBottom = "5px";
    labelPositionDiv.appendChild(labelPositionLabel);
    
    const labelPositionAbove = document.createElement("input");
    labelPositionAbove.type = "radio";
    labelPositionAbove.id = "labelPositionAbove";
    labelPositionAbove.name = "labelPosition";
    labelPositionAbove.value = "above";
    labelPositionAbove.checked = _currentFieldStyle.labelPosition === "above";
    labelPositionAbove.addEventListener("change", (e) => {
      if (e.target.checked) _currentFieldStyle.labelPosition = "above";
    });
    
    const labelPositionLeft = document.createElement("input");
    labelPositionLeft.type = "radio";
    labelPositionLeft.id = "labelPositionLeft";
    labelPositionLeft.name = "labelPosition";
    labelPositionLeft.value = "left";
    labelPositionLeft.checked = _currentFieldStyle.labelPosition === "left";
    labelPositionLeft.addEventListener("change", (e) => {
      if (e.target.checked) _currentFieldStyle.labelPosition = "left";
    });
    
    const labelPositionAboveLabel = document.createElement("label");
    labelPositionAboveLabel.htmlFor = "labelPositionAbove";
    labelPositionAboveLabel.textContent = "Above";
    labelPositionAboveLabel.style.marginRight = "15px";
    
    const labelPositionLeftLabel = document.createElement("label");
    labelPositionLeftLabel.htmlFor = "labelPositionLeft";
    labelPositionLeftLabel.textContent = "Left";
    
    labelPositionDiv.appendChild(labelPositionAbove);
    labelPositionDiv.appendChild(labelPositionAboveLabel);
    labelPositionDiv.appendChild(labelPositionLeft);
    labelPositionDiv.appendChild(labelPositionLeftLabel);
    _fieldStylePopup.appendChild(labelPositionDiv);

    // Label font
    const labelFontDiv = document.createElement("div");
    labelFontDiv.style.marginBottom = "10px";
    const labelFontLabel = document.createElement("label");
    labelFontLabel.textContent = "Label Font:";
    labelFontLabel.style.display = "block";
    labelFontLabel.style.marginBottom = "5px";
    labelFontDiv.appendChild(labelFontLabel);
    
    const labelFontSelect = document.createElement("select");
    labelFontSelect.style.width = "100%";
    labelFontSelect.style.padding = "5px";
    const fontOptions = ["inherit", "Arial", "Calibri", "Times New Roman", "Verdana", "Georgia", "Courier New"];
    fontOptions.forEach(font => {
      const option = document.createElement("option");
      option.value = font;
      option.textContent = font;
      if (font === _currentFieldStyle.labelFont) {
        option.selected = true;
      }
      labelFontSelect.appendChild(option);
    });
    labelFontSelect.addEventListener("change", (e) => {
      _currentFieldStyle.labelFont = e.target.value;
    });
    labelFontDiv.appendChild(labelFontSelect);
    _fieldStylePopup.appendChild(labelFontDiv);

    // Label font size
    const labelFontSizeDiv = document.createElement("div");
    labelFontSizeDiv.style.marginBottom = "10px";
    const labelFontSizeLabel = document.createElement("label");
    labelFontSizeLabel.textContent = "Label Font Size (px):";
    labelFontSizeLabel.style.display = "block";
    labelFontSizeLabel.style.marginBottom = "5px";
    labelFontSizeDiv.appendChild(labelFontSizeLabel);
    
    const labelFontSizeInput = document.createElement("input");
    labelFontSizeInput.type = "number";
    labelFontSizeInput.value = parseInt(_currentFieldStyle.labelFontSize) || 14;
    labelFontSizeInput.style.width = "100%";
    labelFontSizeInput.style.padding = "5px";
    labelFontSizeInput.addEventListener("change", (e) => {
      _currentFieldStyle.labelFontSize = `${e.target.value}px`;
    });
    labelFontSizeDiv.appendChild(labelFontSizeInput);
    _fieldStylePopup.appendChild(labelFontSizeDiv);

    // Label color
    const labelColorDiv = document.createElement("div");
    labelColorDiv.style.marginBottom = "10px";
    const labelColorLabel = document.createElement("label");
    labelColorLabel.textContent = "Label Color:";
    labelColorLabel.style.display = "block";
    labelColorLabel.style.marginBottom = "5px";
    labelColorDiv.appendChild(labelColorLabel);
    
    const labelColorInput = document.createElement("input");
    labelColorInput.type = "color";
    labelColorInput.value = _currentFieldStyle.labelColor || "#000000";
    labelColorInput.style.width = "100%";
    labelColorInput.style.height = "30px";
    labelColorInput.addEventListener("change", (e) => {
      _currentFieldStyle.labelColor = e.target.value;
    });
    labelColorDiv.appendChild(labelColorInput);
    _fieldStylePopup.appendChild(labelColorDiv);

    // Label outline
    const labelOutlineDiv = document.createElement("div");
    labelOutlineDiv.style.marginBottom = "10px";
    const labelOutlineLabel = document.createElement("label");
    labelOutlineLabel.style.display = "flex";
    labelOutlineLabel.style.alignItems = "center";
    labelOutlineLabel.style.gap = "8px";
    const labelOutlineCheck = document.createElement("input");
    labelOutlineCheck.type = "checkbox";
    labelOutlineCheck.checked = _currentFieldStyle.labelOutline;
    labelOutlineCheck.addEventListener("change", (e) => {
      _currentFieldStyle.labelOutline = e.target.checked;
      labelOutlineColorDiv.style.display = e.target.checked ? "block" : "none";
    });
    labelOutlineLabel.appendChild(labelOutlineCheck);
    labelOutlineLabel.appendChild(document.createTextNode("Label Outline"));
    labelOutlineDiv.appendChild(labelOutlineLabel);
    
    const labelOutlineColorDiv = document.createElement("div");
    labelOutlineColorDiv.style.marginTop = "5px";
    labelOutlineColorDiv.style.display = _currentFieldStyle.labelOutline ? "block" : "none";
    const labelOutlineColorLabel = document.createElement("label");
    labelOutlineColorLabel.textContent = "Outline Color:";
    labelOutlineColorLabel.style.display = "block";
    labelOutlineColorLabel.style.marginBottom = "5px";
    labelOutlineColorDiv.appendChild(labelOutlineColorLabel);
    
    const labelOutlineColorInput = document.createElement("input");
    labelOutlineColorInput.type = "color";
    labelOutlineColorInput.value = _currentFieldStyle.labelOutlineColor || "#ffffff";
    labelOutlineColorInput.style.width = "100%";
    labelOutlineColorInput.style.height = "30px";
    labelOutlineColorInput.addEventListener("change", (e) => {
      _currentFieldStyle.labelOutlineColor = e.target.value;
    });
    labelOutlineColorDiv.appendChild(labelOutlineColorInput);
    
    labelOutlineDiv.appendChild(labelOutlineColorDiv);
    _fieldStylePopup.appendChild(labelOutlineDiv);

    // Data justification
    const dataJustifyDiv = document.createElement("div");
    dataJustifyDiv.style.marginBottom = "10px";
    const dataJustifyLabel = document.createElement("label");
    dataJustifyLabel.textContent = "Data Justification:";
    dataJustifyLabel.style.display = "block";
    dataJustifyLabel.style.marginBottom = "5px";
    dataJustifyDiv.appendChild(dataJustifyLabel);
    
    const dataJustifySelect = document.createElement("select");
    dataJustifySelect.style.width = "100%";
    dataJustifySelect.style.padding = "5px";
    const justifyOptions = [
      {value: "left", text: "Left"},
      {value: "center", text: "Center"},
      {value: "right", text: "Right"}
    ];
    justifyOptions.forEach(option => {
      const optEl = document.createElement("option");
      optEl.value = option.value;
      optEl.textContent = option.text;
      if (option.value === _currentFieldStyle.dataJustify) {
        optEl.selected = true;
      }
      dataJustifySelect.appendChild(optEl);
    });
    dataJustifySelect.addEventListener("change", (e) => {
      _currentFieldStyle.dataJustify = e.target.value;
    });
    dataJustifyDiv.appendChild(dataJustifySelect);
    _fieldStylePopup.appendChild(dataJustifyDiv);

    // Height limiting
    const heightLimitDiv = document.createElement("div");
    heightLimitDiv.style.marginBottom = "15px";
    const heightLimitLabel = document.createElement("label");
    heightLimitLabel.style.display = "flex";
    heightLimitLabel.style.alignItems = "center";
    heightLimitLabel.style.gap = "8px";
    const heightLimitCheck = document.createElement("input");
    heightLimitCheck.type = "checkbox";
    heightLimitCheck.checked = _currentFieldStyle.heightLimited;
    heightLimitCheck.addEventListener("change", (e) => {
      _currentFieldStyle.heightLimited = e.target.checked;
      heightLimitRowsDiv.style.display = e.target.checked ? "block" : "none";
    });
    heightLimitLabel.appendChild(heightLimitCheck);
    heightLimitLabel.appendChild(document.createTextNode("Limit Height"));
    heightLimitDiv.appendChild(heightLimitLabel);
    
    const heightLimitRowsDiv = document.createElement("div");
    heightLimitRowsDiv.style.marginTop = "5px";
    heightLimitRowsDiv.style.display = _currentFieldStyle.heightLimited ? "block" : "none";
    const heightLimitRowsLabel = document.createElement("label");
    heightLimitRowsLabel.textContent = "Max Rows:";
    heightLimitRowsLabel.style.display = "block";
    heightLimitRowsLabel.style.marginBottom = "5px";
    heightLimitRowsDiv.appendChild(heightLimitRowsLabel);
    
    const heightLimitRowsInput = document.createElement("input");
    heightLimitRowsInput.type = "number";
    heightLimitRowsInput.min = "1";
    heightLimitRowsInput.value = _currentFieldStyle.maxHeightRows || 1;
    heightLimitRowsInput.style.width = "100%";
    heightLimitRowsInput.style.padding = "5px";
    heightLimitRowsInput.addEventListener("change", (e) => {
      _currentFieldStyle.maxHeightRows = parseInt(e.target.value) || 1;
    });
    heightLimitRowsDiv.appendChild(heightLimitRowsInput);
    
    heightLimitDiv.appendChild(heightLimitRowsDiv);
    _fieldStylePopup.appendChild(heightLimitDiv);

    // Title field checkbox
    const titleFieldDiv = document.createElement("div");
    titleFieldDiv.style.marginBottom = "15px";
    const titleFieldLabel = document.createElement("label");
    titleFieldLabel.style.display = "flex";
    titleFieldLabel.style.alignItems = "center";
    titleFieldLabel.style.gap = "8px";
    const titleFieldCheck = document.createElement("input");
    titleFieldCheck.type = "checkbox";
    titleFieldCheck.checked = _currentFieldStyle.isTitleField;
    titleFieldCheck.addEventListener("change", (e) => {
      _currentFieldStyle.isTitleField = e.target.checked;
    });
    titleFieldLabel.appendChild(titleFieldCheck);
    titleFieldLabel.appendChild(document.createTextNode("This is a Title Field"));
    titleFieldDiv.appendChild(titleFieldLabel);
    _fieldStylePopup.appendChild(titleFieldDiv);

    // Buttons row
    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.justifyContent = "flex-end";
    buttonsDiv.style.gap = "10px";
    buttonsDiv.style.marginTop = "20px";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.padding = "5px 10px";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(_fieldStylePopup);
      _fieldStylePopup = null;
    });
    
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.padding = "5px 10px";
    saveBtn.style.backgroundColor = "#4CAF50";
    saveBtn.style.color = "white";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.addEventListener("click", () => {
      // Update field style in _fields in memory
      const fieldIndex = _fields.findIndex(f => f.colId === _currentFieldId);
      if (fieldIndex >= 0) {
        _fields[fieldIndex].style = {..._currentFieldStyle};
      }
      // We do NOT re-render immediately to avoid partial update confusion
      document.body.removeChild(_fieldStylePopup);
      _fieldStylePopup = null;
    });
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(saveBtn);
    _fieldStylePopup.appendChild(buttonsDiv);

    // Add to document
    document.body.appendChild(_fieldStylePopup);

    // Close popup when clicking outside
    const onClickOutside = (e) => {
      if (_fieldStylePopup && !_fieldStylePopup.contains(e.target)) {
        if (document.body.contains(_fieldStylePopup)) {
          document.body.removeChild(_fieldStylePopup);
        }
        _fieldStylePopup = null;
        document.removeEventListener("click", onClickOutside);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", onClickOutside);
    }, 0);
  }

  //--------------------------------------------------------------------
  // 6) Saving the config
  //--------------------------------------------------------------------
  function onClickSave(existingOptions, layout) {
    // Read from the Styling tab inputs:

    // 1) Widget background
    let wbgMode = "solid";
    [...stWidgetBgMode].forEach(r => { if (r.checked) wbgMode = r.value; });

    // 2) Cards color
    let cMode = "solid";
    [...stCardsColorMode].forEach(r => { if (r.checked) cMode = r.value; });

    // 3) Card border
    let bMode = "solid";
    [...stCardBorderMode].forEach(r => { if (r.checked) bMode = r.value; });

    // 4) Title top bar
    let tbMode = "solid";
    [...stTopBarMode].forEach(r => { if (r.checked) tbMode = r.value; });

    // 5) Handle area
    let haMode = "solid";
    [...stHandleMode].forEach(r => { if (r.checked) haMode = r.value; });

    const newStyling = {
      widgetBackgroundMode: wbgMode,
      widgetBackgroundSolidColor: stWidgetBgColor.value,
      widgetBackgroundGradient: null, // skipping actual gradient storage
      widgetBackgroundField: stWidgetBgField.value || null,

      cardsColorMode: cMode,
      cardsColorSolidColor: stCardsColor.value,
      cardsColorGradient: null,
      cardsColorField: stCardsColorField.value || null,

      cardBorderThickness: parseInt(stCardBorderThickness.value,10) || 0,
      cardBorderMode: bMode,
      cardBorderSolidColor: stCardBorderColor.value,
      cardBorderField: stCardBorderField.value || null,

      cardTitleFontColor: stTitleFontColor.value,
      cardTitleFontStyle: stTitleFontStyle.value,
      cardTitleFontSize: (parseInt(stTitleFontSize.value,10)||20) + "px",

      cardTitleTopBarEnabled: stTopBarEnabled.checked,
      cardTitleTopBarMode: tbMode,
      cardTitleTopBarSolidColor: stTopBarColor.value,
      cardTitleTopBarGradient: null,
      cardTitleTopBarField: stTopBarField.value || null,

      // UPDATED: top bar label/data styling
      cardTitleTopBarLabelFontColor: stTopBarLabelColor.value,
      cardTitleTopBarLabelFontStyle: stTopBarLabelFontStyle.value,
      cardTitleTopBarLabelFontSize: (parseInt(stTopBarLabelFontSize.value, 10)||16)+"px",

      cardTitleTopBarDataFontColor: stTopBarDataColor.value,
      cardTitleTopBarDataFontStyle: stTopBarDataFontStyle.value,
      cardTitleTopBarDataFontSize: (parseInt(stTopBarDataFontSize.value, 10)||16)+"px",

      handleAreaWidth: (parseInt(stHandleWidth.value,10)||8) + "px",
      handleAreaMode: haMode,
      handleAreaSolidColor: stHandleColor.value,
      handleAreaGradient: null,
      handleAreaField: stHandleField.value || null,

      widgetPadding: (parseInt(stWidgetPadding.value, 10)||0) + "px",
      cardsSpacing: (parseInt(stCardsSpacing.value, 10)||0) + "px",

      selectedCard: {
        enabled: stSelEnabled.checked,
        scale: 1 + ((parseInt(stSelScale.value,10)||0)/100),
        colorEffect: stSelColorEffect.value
      }
    };

    // Gather fields layout from "layout" param
    // Gather side panel config
    const sidePanel = { size: spSizeSel.value };

    // Gather view mode from radio
    const tabFld = _configModal.querySelector("[data-tab-section='fld']");
    const vmClick = tabFld.querySelector("#cs-vm-click");
    const viewMode = vmClick.checked ? "click" : "burger";
    const numRows = parseInt(tabFld.querySelector("#cs-num-rows").value, 10) || 1;

    const newOptions = {
      ...existingOptions,
      styling: newStyling,
      sidePanel,
      layout,
      viewMode,
      numRows
    };

    // Now we push them via the standard "postMessage" or "grist.setOptions"
    window.postMessage({
      type: "cardSystem:saveConfig",
      payload: newOptions
    }, "*");

    closeConfig();
  }

  //--------------------------------------------------------------------
  // 7) closeConfig
  //--------------------------------------------------------------------
  function closeConfig() {
    if (_configOverlay?.parentNode) {
      _configOverlay.parentNode.removeChild(_configOverlay);
    }
    _configOpen = false;
    _configOverlay = null;
    _configModal = null;
  }

  //--------------------------------------------------------------------
  // PUBLIC API
  //--------------------------------------------------------------------
  return {
    init,
    renderCards,
    openConfig
  };
})();

// End of CardSystem
